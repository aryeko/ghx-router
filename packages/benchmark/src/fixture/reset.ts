import type { FixtureManifest, Scenario } from "../domain/types.js"
import { resetIssueTriage } from "./seed-issue.js"
import { resetPrBugs } from "./seed-pr-bugs.js"
import { resetMixedPrThreads } from "./seed-pr-mixed-threads.js"
import { resetPrReviewThreads } from "./seed-pr-reviews.js"
import { reseedWorkflowRun, resetWorkflowRun } from "./seed-workflow.js"

type ResetFn = (repo: string, resourceId: number, token: string) => void

type ResetEntry = {
  fn: ResetFn
  requiresToken: boolean
}

const RESET_REGISTRY: Record<string, ResetEntry> = {
  pr_with_bugs: { fn: resetPrBugs, requiresToken: false },
  pr_with_mixed_threads: { fn: resetMixedPrThreads, requiresToken: true },
  pr_with_reviews: { fn: resetPrReviewThreads, requiresToken: true },
  workflow_run: { fn: resetWorkflowRun, requiresToken: false },
  issue_for_triage: { fn: resetIssueTriage, requiresToken: false },
}

export async function resetScenarioFixtures(
  scenario: Scenario,
  manifest: FixtureManifest,
  reviewerToken: string | null,
): Promise<FixtureManifest> {
  if (scenario.fixture?.reseed_per_iteration !== true) {
    return manifest
  }

  const requires = scenario.fixture.requires ?? []

  for (const resource of requires) {
    const entry = RESET_REGISTRY[resource]
    if (!entry) {
      continue
    }

    if (entry.requiresToken && !reviewerToken) {
      console.warn(
        `[benchmark] warn: reseed_per_iteration=true for '${resource}' in scenario '${scenario.id}' but no reviewer token — skipping reset`,
      )
      continue
    }

    const raw = manifest.resources[resource]
    if (typeof raw !== "object" || raw === null) {
      console.warn(
        `[benchmark] warn: fixture resource '${resource}' missing from manifest for scenario '${scenario.id}' — skipping reset`,
      )
      continue
    }

    const rawRecord = raw as Record<string, unknown>
    const resourceId =
      typeof rawRecord["number"] === "number" ? rawRecord["number"] : rawRecord["id"]
    const numId = typeof resourceId === "number" && resourceId !== 0 ? resourceId : null
    if (numId === null) {
      console.warn(
        `[benchmark] warn: fixture resource '${resource}' has no valid id for scenario '${scenario.id}' — skipping reset`,
      )
      continue
    }

    try {
      entry.fn(manifest.repo.full_name, numId, reviewerToken ?? "")
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[benchmark] warn: reset of '${resource}' for scenario '${scenario.id}' failed: ${message} — continuing`,
      )
    }
  }

  if (requires.includes("workflow_run")) {
    try {
      const ref = await reseedWorkflowRun(manifest.repo.full_name, "default")
      if (ref !== null) {
        return {
          ...manifest,
          resources: { ...manifest.resources, workflow_run: { id: ref.id, number: ref.id } },
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(
        `[benchmark] warn: reseed of 'workflow_run' for scenario '${scenario.id}' failed: ${message} — continuing`,
      )
    }
  }

  return manifest
}
