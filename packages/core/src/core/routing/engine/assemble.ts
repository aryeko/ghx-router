import type {
  ChainResultEnvelope,
  ChainStatus,
  ChainStepResult,
  ResultEnvelope,
  ResultError,
  RouteSource,
} from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { logger } from "@core/core/telemetry/log.js"
import type { ClassifiedStep } from "./types.js"

export function isRetryableCode(code: string): boolean {
  return code === errorCodes.RateLimit || code === errorCodes.Network || code === errorCodes.Server
}

export type AssembleInput = {
  steps: ClassifiedStep[]
  requests: Array<{ task: string; input: Record<string, unknown> }>
  // Pre-computed error results for steps that failed before execution (e.g. inject failures)
  stepPreResults: Record<number, ChainStepResult>
  // Raw mutation batch result keyed by alias (e.g. "step0", "step2")
  mutationRawResult: Record<string, unknown>
  // Raw query batch result keyed by alias
  queryRawResult: Record<string, unknown>
  // Per-step GQL errors from batch responses, keyed by alias
  stepErrors: Map<string, string>
  // CLI step results keyed by step index
  cliResults: Map<number, ResultEnvelope>
  // How many steps were CLI-only (used to determine route_used in meta)
  cliStepCount: number
  batchStartMs: number
}

export function assembleChainResult(input: AssembleInput): ChainResultEnvelope {
  const {
    steps,
    requests,
    stepPreResults,
    mutationRawResult,
    queryRawResult,
    stepErrors,
    cliResults,
    cliStepCount,
    batchStartMs,
  } = input

  // Build a set of mutation step indices for better error messages
  const mutationStepIndices = new Set(
    steps.filter((s) => s.route === "gql-mutation").map((s) => s.index),
  )

  const results: ChainStepResult[] = requests.map((req, stepIndex) => {
    if (req === undefined) {
      throw new Error(`invariant violated: request at index ${stepIndex} is undefined`)
    }

    // Use pre-computed error result if available
    const preResult = stepPreResults[stepIndex]
    if (preResult !== undefined) return preResult

    // CLI-only step
    const cliResult = cliResults.get(stepIndex)
    if (cliResult !== undefined) {
      return cliResult.ok
        ? { task: req.task, ok: true, data: cliResult.data }
        : {
            task: req.task,
            ok: false,
            error: cliResult.error ?? {
              code: errorCodes.Unknown,
              message: "CLI step failed",
              retryable: false,
            },
          }
    }

    // GQL step — alias is "step<index>"
    const alias = `step${stepIndex}`

    // Check for per-step GraphQL errors
    const stepError = stepErrors.get(alias)
    if (stepError !== undefined) {
      const code = mapErrorToCode(stepError)
      return {
        task: req.task,
        ok: false,
        error: {
          code,
          message: stepError,
          retryable: isRetryableCode(code),
        },
      }
    }

    // Look up the alias in mutation or query raw result
    if (alias in mutationRawResult) {
      return { task: req.task, ok: true, data: mutationRawResult[alias] }
    }

    if (alias in queryRawResult) {
      return { task: req.task, ok: true, data: queryRawResult[alias] }
    }

    // Determine context-appropriate error message
    const missingMsg = mutationStepIndices.has(stepIndex)
      ? `missing mutation result for alias ${alias}`
      : `missing result for alias ${alias}`

    return {
      task: req.task,
      ok: false,
      error: {
        code: errorCodes.Unknown,
        message: missingMsg,
        retryable: false,
      },
    }
  })

  const succeeded = results.filter((r) => r.ok).length
  const status: ChainStatus =
    succeeded === results.length ? "success" : succeeded === 0 ? "failed" : "partial"

  logger.info("execute_batch.complete", {
    ok: status !== "failed",
    status,
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    duration_ms: Date.now() - batchStartMs,
  })

  // "cli" only when every step was CLI-only. Mixed chains report "graphql" because
  // GraphQL is the primary coordination mechanism even when some steps used the CLI adapter.
  const routeUsed: RouteSource = cliStepCount === requests.length ? "cli" : "graphql"

  return {
    status,
    results,
    meta: {
      route_used: routeUsed,
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
    },
  }
}

export function assembleResolutionFailure(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  steps: ClassifiedStep[],
  phase1Error: ResultError,
  cliResults: Map<number, ResultEnvelope>,
): ChainResultEnvelope {
  const cliStepCount = steps.filter((s) => s.route === "cli").length

  const results: ChainStepResult[] = requests.map((req, i): ChainStepResult => {
    if (req === undefined) {
      throw new Error(`invariant violated: request at index ${i} is undefined`)
    }
    const cliResult = cliResults.get(i)
    if (cliResult !== undefined) {
      return cliResult.ok
        ? { task: req.task, ok: true, data: cliResult.data }
        : {
            task: req.task,
            ok: false,
            error: cliResult.error ?? {
              code: errorCodes.Unknown,
              message: "CLI step failed",
              retryable: false,
            },
          }
    }
    return { task: req.task, ok: false, error: phase1Error }
  })

  const succeeded = results.filter((r) => r.ok).length
  const total = results.length
  const status: ChainStatus =
    succeeded === total ? "success" : succeeded === 0 ? "failed" : "partial"
  const routeUsed: RouteSource = cliStepCount === requests.length ? "cli" : "graphql"

  return {
    status,
    results,
    meta: { route_used: routeUsed, total, succeeded, failed: total - succeeded },
  }
}
