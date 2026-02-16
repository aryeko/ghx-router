import { spawnSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { z } from "zod"

import type { FixtureManifest } from "../domain/types.js"

type SeedOptions = {
  repo: string
  outFile: string
  seedId: string
}

const seedOptionsSchema = z.object({
  repo: z.string().trim().min(1, "invalid repo format: ; expected owner/name"),
  outFile: z.string().trim().min(1, "seed outFile must be a non-empty path"),
  seedId: z.string().trim().min(1, "seedId must be a non-empty string"),
})

const FAILED_RERUN_WORKFLOW_FILE =
  process.env.BENCH_FIXTURE_FAILED_RERUN_WORKFLOW ?? "bench-rerun-failed.yml"
const FAILED_RERUN_POLL_INTERVAL_MS = 2000
const FAILED_RERUN_TIMEOUT_MS = 90_000

function runGh(args: string[]): string {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
  })

  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim()
    throw new Error(stderr.length > 0 ? stderr : `gh command failed: gh ${args.join(" ")}`)
  }

  return (result.stdout ?? "").trim()
}

function tryRunGh(args: string[]): string | null {
  try {
    return runGh(args)
  } catch {
    return null
  }
}

function runGhJson(args: string[]): unknown {
  const output = runGh(args)
  if (output.length === 0) {
    return {}
  }

  return JSON.parse(output)
}

function tryRunGhJson(args: string[]): unknown | null {
  const output = tryRunGh(args)
  if (output === null) {
    return null
  }

  if (output.length === 0) {
    return {}
  }

  return JSON.parse(output)
}

function parseRepo(repo: string): { owner: string; name: string } {
  const parts = repo.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repo format: ${repo}; expected owner/name`)
  }

  const [owner, name] = parts

  return { owner, name }
}

function parseArrayResponse(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === "object" && value !== null) {
    const items = (value as { items?: unknown[] }).items
    if (Array.isArray(items)) {
      return items
    }

    const projects = (value as { projects?: unknown[] }).projects
    if (Array.isArray(projects)) {
      return projects
    }

    const nodes = (value as { nodes?: unknown[] }).nodes
    if (Array.isArray(nodes)) {
      return nodes
    }

    const fields = (value as { fields?: unknown[] }).fields
    if (Array.isArray(fields)) {
      return fields
    }
  }

  return []
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function findOrCreateIssue(
  repo: string,
  seedLabel: string,
): { id: string; number: number; url: string } {
  const { owner, name } = parseRepo(repo)
  const listResult = runGhJson([
    "issue",
    "list",
    "--repo",
    repo,
    "--label",
    "bench-fixture",
    "--label",
    seedLabel,
    "--state",
    "open",
    "--limit",
    "1",
    "--json",
    "id,number,url",
  ])

  const existingItems = Array.isArray(listResult)
    ? listResult
    : Array.isArray((listResult as { [k: string]: unknown }).items)
      ? ((listResult as { items: unknown[] }).items ?? [])
      : []

  const existing = existingItems[0]
  if (typeof existing === "object" && existing !== null) {
    const issue = existing as Record<string, unknown>
    if (
      typeof issue.id === "string" &&
      typeof issue.number === "number" &&
      typeof issue.url === "string"
    ) {
      return {
        id: issue.id,
        number: issue.number,
        url: issue.url,
      }
    }
  }

  const title = `Benchmark fixture issue (${seedLabel})`
  const createResult = runGhJson([
    "api",
    `repos/${owner}/${name}/issues`,
    "--method",
    "POST",
    "-f",
    `title=${title}`,
    "-f",
    "body=Managed by benchmark fixture seeding.",
    "-f",
    "labels[]=bench-fixture",
    "-f",
    `labels[]=${seedLabel}`,
  ])

  const createdIssue = createResult as Record<string, unknown>
  const createdNumber = Number(createdIssue.number)
  if (!Number.isInteger(createdNumber) || createdNumber <= 0) {
    throw new Error("failed to create fixture issue")
  }

  const resolvedIssue = runGhJson([
    "issue",
    "view",
    String(createdNumber),
    "--repo",
    repo,
    "--json",
    "id,number,url",
  ]) as Record<string, unknown>

  return {
    id: String(resolvedIssue.id),
    number: Number(resolvedIssue.number),
    url: String(resolvedIssue.url),
  }
}

function findSeededPr(repo: string, seedLabel: string): { id: string; number: number } | null {
  const listResult = tryRunGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "bench-fixture",
    "--label",
    seedLabel,
    "--limit",
    "1",
    "--json",
    "id,number",
  ])

  const list = parseArrayResponse(listResult)
  const first = list[0]
  if (typeof first !== "object" || first === null) {
    return null
  }

  const pr = first as Record<string, unknown>
  if (typeof pr.id !== "string" || typeof pr.number !== "number") {
    return null
  }

  return {
    id: pr.id,
    number: pr.number,
  }
}

function createSeedPr(
  repo: string,
  seedId: string,
  seedLabel: string,
): { id: string; number: number } {
  const { owner, name } = parseRepo(repo)
  const branch = `bench-seed-${seedId}`
  const contentPath = `.bench/seed-${seedId}.md`

  const refResult = runGhJson(["api", `repos/${owner}/${name}/git/ref/heads/main`]) as Record<
    string,
    unknown
  >
  const object = refResult.object as Record<string, unknown>
  const baseSha = String(object.sha ?? "")
  if (baseSha.length === 0) {
    throw new Error("unable to resolve base sha for fixture PR creation")
  }

  tryRunGhJson([
    "api",
    `repos/${owner}/${name}/git/refs`,
    "--method",
    "POST",
    "-f",
    `ref=refs/heads/${branch}`,
    "-f",
    `sha=${baseSha}`,
  ])

  const body = `# Benchmark fixture seed\nseed: ${seedId}\n`
  const encodedBody = Buffer.from(body, "utf8").toString("base64")

  runGhJson([
    "api",
    `repos/${owner}/${name}/contents/${contentPath}`,
    "--method",
    "PUT",
    "-f",
    `message=chore: seed fixtures (${seedId})`,
    "-f",
    `content=${encodedBody}`,
    "-f",
    `branch=${branch}`,
  ])

  const existingPrResult = tryRunGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--head",
    branch,
    "--limit",
    "1",
    "--json",
    "id,number",
  ])

  const existingPrs = parseArrayResponse(existingPrResult)
  const existingPr = existingPrs[0]
  if (typeof existingPr === "object" && existingPr !== null) {
    const value = existingPr as Record<string, unknown>
    if (typeof value.id === "string" && typeof value.number === "number") {
      return {
        id: value.id,
        number: value.number,
      }
    }
  }

  const prResult = runGhJson([
    "api",
    `repos/${owner}/${name}/pulls`,
    "--method",
    "POST",
    "-f",
    `title=Benchmark fixture PR (${seedLabel})`,
    "-f",
    "body=Managed by benchmark fixture seeding.",
    "-f",
    `head=${branch}`,
    "-f",
    "base=main",
  ]) as Record<string, unknown>

  const number = Number(prResult.number)
  const nodeId = String(prResult.node_id ?? "")

  if (!Number.isInteger(number) || number <= 0 || nodeId.length === 0) {
    throw new Error("failed to create fixture PR")
  }

  tryRunGh([
    "api",
    `repos/${owner}/${name}/issues/${number}/labels`,
    "--method",
    "POST",
    "-f",
    "labels[]=bench-fixture",
    "-f",
    `labels[]=${seedLabel}`,
  ])

  return {
    id: nodeId,
    number,
  }
}

function createMainlineFixtureCommit(repo: string, seedId: string): void {
  const { owner, name } = parseRepo(repo)
  const contentPath = `.bench/main-seed-${seedId}.md`
  const body = `# Benchmark mainline seed\nseed: ${seedId}\n`
  const encodedBody = Buffer.from(body, "utf8").toString("base64")

  runGhJson([
    "api",
    `repos/${owner}/${name}/contents/${contentPath}`,
    "--method",
    "PUT",
    "-f",
    `message=chore: seed mainline fixture (${seedId})`,
    "-f",
    `content=${encodedBody}`,
    "-f",
    "branch=main",
  ])
}

function getPrHeadSha(repo: string, prNumber: number): string | null {
  const result = tryRunGhJson([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "headRefOid",
  ])
  if (typeof result !== "object" || result === null) {
    return null
  }

  const sha = (result as { headRefOid?: unknown }).headRefOid
  return typeof sha === "string" && sha.length > 0 ? sha : null
}

function findPrThreadId(repo: string, prNumber: number): string | null {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    "graphql",
    "-f",
    "query=query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:20){nodes{id}}}}}",
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${name}`,
    "-F",
    `num=${prNumber}`,
  ])

  if (typeof result !== "object" || result === null) {
    return null
  }

  const nodes = (
    ((result as { data?: unknown }).data as { repository?: unknown } | undefined)?.repository as
      | {
          pullRequest?: unknown
        }
      | undefined
  )?.pullRequest as { reviewThreads?: unknown } | undefined

  const threadNodes = parseArrayResponse((nodes?.reviewThreads ?? {}) as unknown)
  const first = threadNodes[0]
  if (typeof first !== "object" || first === null) {
    return null
  }

  const id = (first as { id?: unknown }).id
  return typeof id === "string" && id.length > 0 ? id : null
}

function ensurePrThread(repo: string, prNumber: number, seedId: string): string {
  const existingThreadId = findPrThreadId(repo, prNumber)
  if (existingThreadId) {
    return existingThreadId
  }

  const headSha = getPrHeadSha(repo, prNumber)
  if (headSha) {
    const { owner, name } = parseRepo(repo)
    tryRunGh([
      "api",
      `repos/${owner}/${name}/pulls/${prNumber}/comments`,
      "--method",
      "POST",
      "-f",
      `body=Benchmark review thread seed (${seedId})`,
      "-f",
      `commit_id=${headSha}`,
      "-f",
      `path=.bench/seed-${seedId}.md`,
      "-F",
      "line=1",
      "-f",
      "side=RIGHT",
    ])
  }

  return findPrThreadId(repo, prNumber) ?? ""
}

function parseWorkflowRunIdFromLink(link: string): number | null {
  const match = /\/actions\/runs\/(\d+)/.exec(link)
  if (!match) {
    return null
  }

  const runId = Number(match[1])
  return Number.isInteger(runId) && runId > 0 ? runId : null
}

function parseWorkflowRunCreatedAtMs(entry: Record<string, unknown>): number {
  const createdAt = typeof entry.createdAt === "string" ? Date.parse(entry.createdAt) : Number.NaN
  return Number.isFinite(createdAt) ? createdAt : 0
}

function findDispatchedFailedRunId(
  repo: string,
  seedId: string,
  dispatchedAtMs: number,
): number | null {
  const listResult = tryRunGhJson([
    "run",
    "list",
    "--repo",
    repo,
    "--workflow",
    FAILED_RERUN_WORKFLOW_FILE,
    "--event",
    "workflow_dispatch",
    "--limit",
    "20",
    "--json",
    "databaseId,displayTitle,createdAt",
  ])

  const runs = parseArrayResponse(listResult)
    .filter(
      (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
    )
    .sort((left, right) => parseWorkflowRunCreatedAtMs(right) - parseWorkflowRunCreatedAtMs(left))

  const tagged = runs.find((entry) => {
    const title = typeof entry.displayTitle === "string" ? entry.displayTitle : ""
    return title.includes(seedId)
  })

  if (tagged && Number.isInteger(Number(tagged.databaseId)) && Number(tagged.databaseId) > 0) {
    return Number(tagged.databaseId)
  }

  const nearDispatch = runs.find((entry) => {
    const createdAtMs = parseWorkflowRunCreatedAtMs(entry)
    return createdAtMs >= dispatchedAtMs - 10_000
  })

  if (
    nearDispatch &&
    Number.isInteger(Number(nearDispatch.databaseId)) &&
    Number(nearDispatch.databaseId) > 0
  ) {
    return Number(nearDispatch.databaseId)
  }

  return null
}

function parseCheckRunIdFromJob(entry: Record<string, unknown>): number | null {
  const directIdCandidates = [entry.checkRunId, entry.check_run_id]
  for (const candidate of directIdCandidates) {
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0) {
      return Number(candidate)
    }
  }

  const urlCandidates = [entry.checkRunUrl, entry.check_run_url]
  for (const candidate of urlCandidates) {
    if (typeof candidate !== "string") {
      continue
    }

    const match = candidate.match(/\/check-runs\/(\d+)(?:[/?#]|$)/)
    if (!match) {
      continue
    }

    const parsed = Number(match[1])
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}

function readWorkflowRunJobRefs(
  repo: string,
  runId: number,
): { job_id: number | null; check_run_id: number | null } {
  const jobsResult = runGhJson(["run", "view", String(runId), "--repo", repo, "--json", "jobs"])
  const jobs = Array.isArray((jobsResult as { jobs?: unknown[] }).jobs)
    ? (jobsResult as { jobs: unknown[] }).jobs
    : []
  const failedJob = jobs.find((entry) => {
    if (typeof entry !== "object" || entry === null) {
      return false
    }

    const conclusion = String((entry as Record<string, unknown>).conclusion ?? "").toLowerCase()
    return conclusion === "failure"
  })
  const selectedJob = failedJob ?? jobs[0]
  if (typeof selectedJob !== "object" || selectedJob === null) {
    return {
      job_id: null,
      check_run_id: null,
    }
  }

  const selectedJobRecord = selectedJob as Record<string, unknown>
  const jobId =
    typeof selectedJobRecord.databaseId === "number" &&
    Number.isInteger(selectedJobRecord.databaseId)
      ? Number(selectedJobRecord.databaseId)
      : null

  return {
    job_id: jobId,
    check_run_id: parseCheckRunIdFromJob(selectedJobRecord),
  }
}

type WorkflowRunRef = {
  id: number
  job_id: number | null
  check_run_id: number | null
}

async function ensureFailedRerunWorkflowRun(
  repo: string,
  seedId: string,
): Promise<WorkflowRunRef | null> {
  const dispatchedAtMs = Date.now()
  const dispatchOutput = tryRunGh([
    "workflow",
    "run",
    FAILED_RERUN_WORKFLOW_FILE,
    "--repo",
    repo,
    "-f",
    `seed_id=${seedId}`,
  ])

  if (dispatchOutput === null) {
    return null
  }

  const deadline = dispatchedAtMs + FAILED_RERUN_TIMEOUT_MS
  while (Date.now() < deadline) {
    const runId = findDispatchedFailedRunId(repo, seedId, dispatchedAtMs)
    if (runId === null) {
      await sleep(FAILED_RERUN_POLL_INTERVAL_MS)
      continue
    }

    const runResult = tryRunGhJson([
      "run",
      "view",
      String(runId),
      "--repo",
      repo,
      "--json",
      "status,conclusion",
    ])
    if (typeof runResult !== "object" || runResult === null) {
      await sleep(FAILED_RERUN_POLL_INTERVAL_MS)
      continue
    }

    const status = String((runResult as Record<string, unknown>).status ?? "").toLowerCase()
    const conclusion = String((runResult as Record<string, unknown>).conclusion ?? "").toLowerCase()
    if (status !== "completed") {
      await sleep(FAILED_RERUN_POLL_INTERVAL_MS)
      continue
    }

    if (conclusion !== "failure") {
      throw new Error(
        `expected failed rerun fixture workflow to conclude with failure; got conclusion=${conclusion || "unknown"}`,
      )
    }

    const refs = readWorkflowRunJobRefs(repo, runId)
    return {
      id: runId,
      job_id: refs.job_id,
      check_run_id: refs.check_run_id,
    }
  }

  throw new Error(
    `timed out waiting for failed rerun fixture workflow (${FAILED_RERUN_WORKFLOW_FILE})`,
  )
}

function findLatestWorkflowRun(repo: string, prNumber: number): WorkflowRunRef | null {
  const prChecksResult = tryRunGhJson([
    "pr",
    "checks",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "state,link",
  ])
  const checks = parseArrayResponse(prChecksResult)
  const checkEntries = checks.filter(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
  )
  const failedCheck = checkEntries.find(
    (entry) => String(entry.state ?? "").toUpperCase() === "FAILURE",
  )
  const firstCheck = checkEntries[0]
  const linkedRunId = [failedCheck, firstCheck]
    .map((entry) =>
      typeof entry?.link === "string" ? parseWorkflowRunIdFromLink(entry.link) : null,
    )
    .find((id): id is number => id !== null)

  if (linkedRunId !== undefined) {
    const jobsResult = runGhJson([
      "run",
      "view",
      String(linkedRunId),
      "--repo",
      repo,
      "--json",
      "jobs",
    ])
    const jobs = Array.isArray((jobsResult as { jobs?: unknown[] }).jobs)
      ? (jobsResult as { jobs: unknown[] }).jobs
      : []
    const firstJob = jobs[0]
    const refs =
      typeof firstJob === "object" && firstJob !== null
        ? {
            job_id:
              typeof (firstJob as Record<string, unknown>).databaseId === "number"
                ? Number((firstJob as Record<string, unknown>).databaseId)
                : null,
            check_run_id: parseCheckRunIdFromJob(firstJob as Record<string, unknown>),
          }
        : {
            job_id: null,
            check_run_id: null,
          }

    return {
      id: linkedRunId,
      job_id: refs.job_id,
      check_run_id: refs.check_run_id,
    }
  }

  const runListArgsCandidates: string[][] = [
    [
      "run",
      "list",
      "--repo",
      repo,
      "--workflow",
      "ci.yml",
      "--status",
      "failure",
      "--limit",
      "1",
      "--json",
      "databaseId",
    ],
    ["run", "list", "--repo", repo, "--workflow", "ci.yml", "--limit", "1", "--json", "databaseId"],
  ]

  let runId: number | null = null
  for (const args of runListArgsCandidates) {
    const runResult = tryRunGhJson(args)
    const runs = Array.isArray(runResult)
      ? runResult
      : Array.isArray((runResult as { [k: string]: unknown } | null)?.items)
        ? ((runResult as { items: unknown[] }).items ?? [])
        : []
    const first = runs[0]
    if (!first || typeof first !== "object") {
      continue
    }

    const candidateRunId = Number((first as Record<string, unknown>).databaseId)
    if (Number.isInteger(candidateRunId) && candidateRunId > 0) {
      runId = candidateRunId
      break
    }
  }

  if (runId === null) {
    return null
  }

  const runIdNumber = Number(runId)
  if (!Number.isInteger(runIdNumber) || runIdNumber <= 0) {
    return null
  }

  const refs = readWorkflowRunJobRefs(repo, runIdNumber)

  return {
    id: runIdNumber,
    job_id: refs.job_id,
    check_run_id: refs.check_run_id,
  }
}

function findLatestDraftRelease(repo: string): { id: number; tag_name: string } | null {
  const { owner, name } = parseRepo(repo)
  const releasesResult = runGhJson(["api", `repos/${owner}/${name}/releases?per_page=20`])
  const releases = Array.isArray(releasesResult) ? releasesResult : []

  for (const item of releases) {
    if (typeof item !== "object" || item === null) {
      continue
    }
    const release = item as Record<string, unknown>
    if (
      release.draft === true &&
      typeof release.id === "number" &&
      typeof release.tag_name === "string"
    ) {
      return {
        id: release.id,
        tag_name: release.tag_name,
      }
    }
  }

  return null
}

function ensureProjectFixture(
  owner: string,
  issueUrl: string,
): { number: number; id: string; item_id: string; field_id: string; option_id: string } {
  const fixtureProjectTitle = "GHX Bench Fixtures"
  const listResult = runGhJson(["project", "list", "--owner", owner, "--format", "json"])
  const projects = parseArrayResponse(listResult)

  let project: { number: number; id: string } | null = null
  for (const entry of projects) {
    if (typeof entry !== "object" || entry === null) {
      continue
    }
    const value = entry as Record<string, unknown>
    if (typeof value.number === "number" && typeof value.id === "string") {
      const title = typeof value.title === "string" ? value.title : ""
      if (title.toLowerCase() === fixtureProjectTitle.toLowerCase()) {
        project = { number: value.number, id: value.id }
        break
      }
    }
  }

  if (!project) {
    const created = runGhJson([
      "project",
      "create",
      "--owner",
      owner,
      "--title",
      fixtureProjectTitle,
      "--format",
      "json",
    ]) as Record<string, unknown>
    project = {
      number: Number(created.number),
      id: String(created.id),
    }
  }

  const itemResult = tryRunGhJson([
    "project",
    "item-add",
    String(project.number),
    "--owner",
    owner,
    "--url",
    issueUrl,
    "--format",
    "json",
  ])
  const itemId =
    typeof itemResult === "object" &&
    itemResult !== null &&
    typeof (itemResult as { id?: unknown }).id === "string"
      ? String((itemResult as { id: string }).id)
      : ""

  const fieldResult = tryRunGhJson([
    "project",
    "field-list",
    String(project.number),
    "--owner",
    owner,
    "--format",
    "json",
  ])
  const fields = parseArrayResponse(fieldResult)
  let fieldId = ""
  let optionId = ""

  for (const entry of fields) {
    if (typeof entry !== "object" || entry === null) {
      continue
    }
    const value = entry as Record<string, unknown>
    const type = typeof value.type === "string" ? value.type : ""
    const id = typeof value.id === "string" ? value.id : ""
    const options = Array.isArray(value.options) ? value.options : []
    if (type === "ProjectV2SingleSelectField" && id.length > 0 && options.length > 0) {
      const firstOption = options[0]
      const candidate =
        typeof firstOption === "object" &&
        firstOption !== null &&
        typeof (firstOption as { id?: unknown }).id === "string"
          ? String((firstOption as { id: string }).id)
          : ""
      if (candidate.length > 0) {
        fieldId = id
        optionId = candidate
        break
      }
    }
  }

  return {
    number: project.number,
    id: project.id,
    item_id: itemId,
    field_id: fieldId,
    option_id: optionId,
  }
}

async function buildManifest(repo: string, seedId: string): Promise<FixtureManifest> {
  const { owner, name } = parseRepo(repo)
  const seedLabel = `bench-seed:${seedId}`

  runGh(["label", "create", "bench-fixture", "--repo", repo, "--color", "5319E7", "--force"])
  runGh(["label", "create", seedLabel, "--repo", repo, "--color", "1D76DB", "--force"])

  const issue = findOrCreateIssue(repo, seedLabel)
  const blockerIssue = issue
  const parentIssue = issue
  const pr = findSeededPr(repo, seedLabel) ?? createSeedPr(repo, seedId, seedLabel)
  createMainlineFixtureCommit(repo, seedId)
  const prThreadId = ensurePrThread(repo, pr.number, seedId)
  let workflowRun: WorkflowRunRef | null = null
  try {
    workflowRun = await ensureFailedRerunWorkflowRun(repo, seedId)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(
      `warning: failed rerun fixture workflow unavailable (${message}); falling back to latest workflow run`,
    )
  }

  if (!workflowRun) {
    workflowRun = findLatestWorkflowRun(repo, pr.number)
  }
  const release = findLatestDraftRelease(repo)
  let project: { number: number; id: string; item_id: string; field_id: string; option_id: string }
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

export async function seedFixtureManifest(options: SeedOptions): Promise<FixtureManifest> {
  const parsed = seedOptionsSchema.parse(options)
  const manifest = await buildManifest(parsed.repo, parsed.seedId)
  await mkdir(dirname(parsed.outFile), { recursive: true })
  await writeFile(parsed.outFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8")
  return manifest
}
