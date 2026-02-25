import type { ChainResultEnvelope } from "@core/core/contracts/envelope.js"
import type { ErrorCode } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { logger } from "@core/core/telemetry/log.js"
import { assembleChainResult, assembleResolutionFailure, isRetryableCode } from "./assemble.js"
import { collectCliResults, startCliSteps } from "./cli-dispatch.js"
import { runGqlExecutePhase } from "./execute.js"
import { runPreflight } from "./preflight.js"
import { runResolutionPhase } from "./resolve.js"
import type { ExecutionDeps } from "./types.js"

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
  const cliSteps = steps.filter((s) => s.route === "cli")
  const gqlSteps = steps.filter((s) => s.route === "gql-query" || s.route === "gql-mutation")
  const cliStepCount = cliSteps.length

  // Start CLI steps concurrently with Phase 1 resolution
  const cliPromises = startCliSteps(steps, requests, deps)

  // Phase 1: batch resolution queries (runs concurrently with CLI steps)
  let lookupResults: import("./resolve.js").ResolutionResults = {}
  try {
    lookupResults = await runResolutionPhase(
      gqlSteps,
      requests,
      deps.githubClient,
      deps.resolutionCache,
    )
  } catch (err) {
    const code = mapErrorToCode(err)
    const errorMsg = err instanceof Error ? err.message : String(err)
    logger.error("resolution.lookup_failed", {
      count: gqlSteps.length,
      error_code: code,
      message: errorMsg,
    })
    const cliResults = await collectCliResults(cliPromises, cliSteps, requests)
    return assembleResolutionFailure(
      requests,
      steps,
      {
        code: code as ErrorCode,
        message: `Phase 1 (resolution) failed: ${errorMsg}`,
        retryable: isRetryableCode(code),
      },
      cliResults,
    )
  }

  // Phase 2: execute GQL mutations and queries
  const { mutationRawResult, queryRawResult, stepErrors } = await runGqlExecutePhase(
    gqlSteps,
    requests,
    lookupResults,
    deps,
  )

  // Collect CLI results (they've been running concurrently since Phase 1 started)
  const cliResults = await collectCliResults(cliPromises, cliSteps, requests)

  // Assemble final result
  return assembleChainResult({
    steps,
    requests,
    mutationRawResult,
    queryRawResult,
    stepErrors,
    cliResults,
    cliStepCount,
    batchStartMs,
  })
}
