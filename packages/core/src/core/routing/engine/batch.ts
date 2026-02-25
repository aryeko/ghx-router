import type {
  ChainResultEnvelope,
  ChainStepResult,
  ResultEnvelope,
  ResultError,
} from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { logger } from "@core/core/telemetry/log.js"
import { assembleChainResult } from "./assemble.js"
import { runExecutePhase } from "./execute.js"
import { runPreflight } from "./preflight.js"
import { runResolutionPhase } from "./resolve.js"
import { executeFullRoute } from "./single.js"
import type { ExecutionDeps } from "./types.js"

function isRetryableCode(code: string): boolean {
  return code === errorCodes.RateLimit || code === errorCodes.Network || code === errorCodes.Server
}

export async function executeBatch(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope> {
  const batchStartMs = Date.now()

  // Phase 0: preflight — validate all steps
  const preflight = runPreflight(requests)
  if (!preflight.ok) {
    return {
      status: "failed",
      results: preflight.results,
      meta: {
        route_used: preflight.routeUsed,
        total: requests.length,
        succeeded: 0,
        failed: requests.length,
      },
    }
  }

  const { steps } = preflight

  // Determine CLI-only step count for route_used in meta
  const cliStepCount = steps.filter((s) => s.route === "cli").length

  // Prepare CLI step execution (to run concurrently with Phase 1)
  const executeCliStep = async (
    task: string,
    input: Record<string, unknown>,
  ): Promise<ResultEnvelope> => {
    return executeFullRoute({ task, input }, deps)
  }

  const cliSteps = steps.filter((s) => s.route === "cli")

  // Start CLI steps concurrently with Phase 1 resolution
  const cliPromises = cliSteps.map((step) => {
    const req = requests[step.index]
    if (req === undefined) {
      return Promise.resolve<[number, ResultEnvelope]>([
        step.index,
        {
          ok: false,
          error: { code: errorCodes.Unknown, message: "missing request", retryable: false },
          meta: { capability_id: step.card.capability_id, route_used: "cli" },
        },
      ])
    }
    return executeCliStep(req.task, req.input)
      .then((result): [number, ResultEnvelope] => [step.index, result])
      .catch((err: unknown): [number, ResultEnvelope] => [
        step.index,
        {
          ok: false,
          error: {
            code: errorCodes.Unknown,
            message: err instanceof Error ? err.message : String(err),
            retryable: false,
          },
          meta: { capability_id: req.task, route_used: "cli" },
        },
      ])
  })

  // Phase 1: batch resolution queries (runs concurrently with CLI steps)
  let lookupResults: import("./resolve.js").ResolutionResults = {}
  const gqlSteps = steps.filter((s) => s.route === "gql-query" || s.route === "gql-mutation")

  let phase1Error: ResultError | null = null

  try {
    lookupResults = await runResolutionPhase(
      gqlSteps,
      requests,
      deps.githubClient,
      deps.resolutionCache,
    )
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const code = mapErrorToCode(err)
    logger.error("resolution.lookup_failed", {
      count: gqlSteps.length,
      error_code: code,
      message: errorMsg,
    })
    phase1Error = {
      code: code as import("@core/core/errors/codes.js").ErrorCode,
      message: `Phase 1 (resolution) failed: ${errorMsg}`,
      retryable: isRetryableCode(code),
    }
  }

  if (phase1Error !== null) {
    // Phase 1 failed — drain any in-flight CLI promises and combine results
    const cliOutcomes = await Promise.allSettled(cliPromises)
    const cliResults = new Map<number, ResultEnvelope>()

    for (let j = 0; j < cliSteps.length; j += 1) {
      const step = cliSteps[j]
      const outcome = cliOutcomes[j]
      if (step === undefined || outcome === undefined) continue

      if (outcome.status === "fulfilled") {
        const [, result] = outcome.value
        cliResults.set(step.index, result)
      } else {
        const msg =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
        const req = requests[step.index]
        cliResults.set(step.index, {
          ok: false,
          error: { code: errorCodes.Unknown, message: msg, retryable: false },
          meta: { capability_id: req?.task ?? "unknown", route_used: "cli" },
        })
      }
    }

    // Build results: CLI steps use their results, GQL steps use Phase 1 error
    const results: ChainStepResult[] = requests.map((req, i): ChainStepResult => {
      if (req === undefined) {
        throw new Error(`invariant violated: request at index ${i} is undefined`)
      }
      const cliResult = cliResults.get(i)
      if (cliResult !== undefined) {
        if (cliResult.ok) {
          return { task: req.task, ok: true, data: cliResult.data }
        }
        return {
          task: req.task,
          ok: false,
          error: cliResult.error ?? {
            code: errorCodes.Unknown,
            message: "CLI step failed",
            retryable: false,
          },
        }
      }
      const err = phase1Error ?? {
        code: errorCodes.Unknown as import("@core/core/errors/codes.js").ErrorCode,
        message: "Phase 1 failed",
        retryable: false,
      }
      return {
        task: req.task,
        ok: false,
        error: err,
      }
    })

    const succeeded = results.filter((r) => r.ok).length
    const status = succeeded === results.length ? "success" : succeeded === 0 ? "failed" : "partial"
    const routeUsed = cliStepCount === requests.length ? "cli" : "graphql"

    logger.error("execute_batch.phase1_failed", {
      total: requests.length,
      cli_succeeded: succeeded,
    })

    return {
      status,
      results,
      meta: {
        route_used: routeUsed,
        total: requests.length,
        succeeded,
        failed: requests.length - succeeded,
      },
    }
  }

  // Phase 2 & 3: execute mutations, queries, and CLI steps concurrently
  // Pass cliPromises to runExecutePhase so CLI steps aren't re-dispatched
  const { mutationRawResult, queryRawResult, stepErrors, cliResults } = await runExecutePhase(
    steps,
    requests,
    lookupResults,
    deps,
    executeCliStep,
    cliPromises,
  )

  // Assemble final result
  return assembleChainResult({
    steps,
    requests,
    stepPreResults: {},
    mutationRawResult,
    queryRawResult,
    stepErrors,
    cliResults,
    cliStepCount,
    batchStartMs,
  })
}
