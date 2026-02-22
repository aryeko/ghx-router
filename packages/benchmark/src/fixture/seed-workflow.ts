import { runGhJson, sleep, tryRunGh, tryRunGhJson } from "./gh-client.js"
import { parseArrayResponse } from "./gh-utils.js"
import {
  parseCheckRunIdFromJob,
  parseWorkflowRunCreatedAtMs,
  parseWorkflowRunIdFromLink,
} from "./workflow-parse-utils.js"

const FAILED_RERUN_WORKFLOW_FILE =
  process.env.BENCH_FIXTURE_FAILED_RERUN_WORKFLOW ?? "bench-rerun-failed.yml"
const FAILED_RERUN_POLL_INTERVAL_MS = 2000
const FAILED_RERUN_TIMEOUT_MS = 90_000

export function findDispatchedFailedRunId(
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

export async function ensureFailedRerunWorkflowRun(
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
        `expected failed rerun fixture workflow to conclude with failure; got conclusion=${
          conclusion || "unknown"
        }`,
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

export function findLatestWorkflowRun(repo: string, prNumber: number): WorkflowRunRef | null {
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

export type { WorkflowRunRef }
