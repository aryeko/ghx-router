import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import type { FixtureManifest } from "../domain/types.js"
import { runGh } from "./gh-client.js"
import { findOrCreateIssue } from "./seed-issue.js"
import { createPrWithReviews, createSeedPr, ensurePrThread, findSeededPr } from "./seed-pr.js"
import { ensureProjectFixture } from "./seed-project.js"
import { findLatestDraftRelease } from "./seed-release.js"
import {
  ensureFailedRerunWorkflowRun,
  findLatestWorkflowRun,
  type WorkflowRunRef,
} from "./seed-workflow.js"

const VALID_REQUIRES = [
  "issue",
  "pr",
  "pr_with_reviews",
  "workflow_run",
  "release",
  "project",
] as const

type SeedOptions = {
  repo: string
  outFile: string
  seedId: string
  requires?: string[]
}

const seedOptionsSchema = z.object({
  repo: z.string().trim().min(1, "invalid repo format: ; expected owner/name"),
  outFile: z.string().trim().min(1, "seed outFile must be a non-empty path"),
  seedId: z.string().trim().min(1, "seedId must be a non-empty string"),
  requires: z.array(z.enum(VALID_REQUIRES)).optional(),
})

function parseRepo(repo: string): { owner: string; name: string } {
  const parts = repo.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repo format: ${repo}; expected owner/name`)
  }

  const [owner, name] = parts

  return { owner, name }
}

async function buildManifest(
  repo: string,
  seedId: string,
  reviewerToken: string | null,
  requires: ReadonlySet<string>,
): Promise<FixtureManifest> {
  const { owner, name } = parseRepo(repo)
  const seedLabel = `bench-seed:${seedId}`

  const needs = (resource: string): boolean => requires.size === 0 || requires.has(resource)

  runGh(["label", "create", "bench-fixture", "--repo", repo, "--color", "5319E7", "--force"])
  runGh(["label", "create", seedLabel, "--repo", repo, "--color", "1D76DB", "--force"])

  // Issue: needed by "issue", "pr" (pr_thread depends on pr which uses issue for fallback), "project"
  const needsIssue = needs("issue") || needs("pr") || needs("project")
  const issue = needsIssue ? findOrCreateIssue(repo, seedLabel) : { id: "", number: 0, url: "" }
  const blockerIssue = issue
  const parentIssue = issue

  // PR + thread: needed by "pr"
  const needsPr = needs("pr")
  const pr = needsPr
    ? (findSeededPr(repo, seedLabel) ?? createSeedPr(repo, seedId, seedLabel))
    : { id: "", number: 0 }
  const prThreadId = needsPr ? ensurePrThread(repo, pr.number, seedId) : ""

  // PR with reviews: needed by "pr_with_reviews"
  type PrWithReviews = { id: string; number: number; thread_count: number }
  let prWithReviews: PrWithReviews | null = null
  if (needs("pr_with_reviews")) {
    if (reviewerToken) {
      try {
        prWithReviews = createPrWithReviews(repo, seedId, seedLabel, reviewerToken)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`warning: unable to seed pr_with_reviews fixture (${message})`)
      }
    } else {
      console.warn(
        "warning: skipping pr_with_reviews — no reviewer token available. " +
          "Configure BENCH_FIXTURE_GH_APP_* env vars to enable.",
      )
    }
  }

  // Workflow run: needed by "workflow_run"
  let workflowRun: WorkflowRunRef | null = null
  if (needs("workflow_run")) {
    try {
      workflowRun = await ensureFailedRerunWorkflowRun(repo, seedId)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `warning: failed rerun fixture workflow unavailable (${message}); falling back to latest workflow run`,
      )
    }

    if (!workflowRun && needsPr) {
      workflowRun = findLatestWorkflowRun(repo, pr.number)
    }
  }

  // Release: needed by "release"
  const release = needs("release") ? findLatestDraftRelease(repo) : null

  // Project: needed by "project"
  let project: { number: number; id: string; item_id: string; field_id: string; option_id: string }
  if (needs("project")) {
    try {
      project = ensureProjectFixture(owner, issue.url)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `warning: unable to seed project fixture (${message}); using placeholder project fixture values`,
      )
      project = {
        number: 1,
        id: "",
        item_id: "",
        field_id: "",
        option_id: "",
      }
    }
  } else {
    project = {
      number: 1,
      id: "",
      item_id: "",
      field_id: "",
      option_id: "",
    }
  }

  const manifest: FixtureManifest = {
    version: 1,
    repo: {
      owner,
      name,
      full_name: repo,
      default_branch: "main",
    },
    resources: {
      issue,
      blocker_issue: blockerIssue,
      parent_issue: parentIssue,
      pr,
      pr_with_reviews: prWithReviews ?? {
        id: "",
        number: 0,
        thread_count: 0,
      },
      pr_thread: {
        id: prThreadId,
      },
      workflow_run: workflowRun ?? {
        id: 1,
      },
      workflow_job: {
        id: workflowRun?.job_id ?? 1,
      },
      check_run: {
        id: workflowRun?.check_run_id ?? 1,
      },
      release: release ?? {
        id: 1,
        tag_name: "v0.0.0-bench",
      },
      project,
      metadata: {
        seed_id: seedId,
        generated_at: new Date().toISOString(),
        run_id: randomUUID(),
      },
    },
  }

  return manifest
}

export async function seedFixtureManifest(
  options: SeedOptions,
  reviewerToken?: string | null,
): Promise<FixtureManifest> {
  const parsed = seedOptionsSchema.parse(options)
  const requires = new Set(parsed.requires ?? VALID_REQUIRES)
  const manifest = await buildManifest(parsed.repo, parsed.seedId, reviewerToken ?? null, requires)
  await mkdir(dirname(parsed.outFile), { recursive: true })
  await writeFile(parsed.outFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  return manifest
}
