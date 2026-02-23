import type { GithubClient } from "@ghx-dev/core"
import { executeTask } from "@ghx-dev/core"
import type { WorkflowCheckpoint } from "../domain/types.js"
import { isObject } from "../util/guards.js"

export type CheckpointResult = {
  name: string
  passed: boolean
  data: unknown
}

function resolveCheckpointData(data: unknown, field?: string): unknown {
  const unwrapped =
    isObject(data) && "items" in data && Array.isArray((data as Record<string, unknown>).items)
      ? (data as Record<string, unknown>).items
      : data
  if (field && isObject(unwrapped)) {
    return (unwrapped as Record<string, unknown>)[field] ?? null
  }
  return unwrapped
}

export function evaluateCondition(
  condition: "empty" | "non_empty" | "count_gte" | "count_eq" | "field_equals",
  data: unknown,
  expectedValue?: unknown,
): boolean {
  switch (condition) {
    case "empty":
      return Array.isArray(data) ? data.length === 0 : data === null || data === undefined
    case "non_empty":
      return Array.isArray(data) ? data.length > 0 : data !== null && data !== undefined
    case "count_gte":
      return Array.isArray(data) && data.length >= Number(expectedValue)
    case "count_eq":
      return Array.isArray(data) && data.length === Number(expectedValue)
    case "field_equals": {
      if (!isObject(data) || !isObject(expectedValue)) {
        return false
      }
      const expected = expectedValue as Record<string, unknown>
      const actual = data as Record<string, unknown>
      return Object.entries(expected).every(([key, value]) => actual[key] === value)
    }
    default:
      return false
  }
}

const POLL_MAX_ATTEMPTS = 6
const POLL_INTERVAL_MS = 2000

async function evaluateCheckpoint(
  checkpoint: WorkflowCheckpoint,
  githubClient: GithubClient,
  githubToken: string,
): Promise<CheckpointResult> {
  const verificationResult = await executeTask(
    {
      task: checkpoint.verification_task,
      input: checkpoint.verification_input,
    },
    {
      githubClient,
      githubToken,
      skipGhPreflight: true,
    },
  )

  const ok = verificationResult.ok === true
  const data = ok
    ? resolveCheckpointData(verificationResult.data, checkpoint.verification_field)
    : null
  const passed = ok
    ? evaluateCondition(checkpoint.condition, data, checkpoint.expected_value)
    : false

  return { name: checkpoint.name, passed, data }
}

export async function evaluateCheckpoints(
  checkpoints: WorkflowCheckpoint[],
  githubToken: string,
): Promise<{ allPassed: boolean; results: CheckpointResult[] }> {
  const { createGithubClientFromToken } = await import("@ghx-dev/core")
  const githubClient = createGithubClientFromToken(githubToken)

  const results: CheckpointResult[] = []

  for (const checkpoint of checkpoints) {
    let last: CheckpointResult = { name: checkpoint.name, passed: false, data: null }

    for (let attempt = 1; attempt <= POLL_MAX_ATTEMPTS; attempt += 1) {
      try {
        last = await evaluateCheckpoint(checkpoint, githubClient, githubToken)
      } catch (err: unknown) {
        last = {
          name: checkpoint.name,
          passed: false,
          data: { error: err instanceof Error ? err.message : String(err) },
        }
      }

      if (last.passed || attempt === POLL_MAX_ATTEMPTS) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }

    results.push(last)
  }

  const allPassed = results.every((c) => c.passed)
  return { allPassed, results }
}
