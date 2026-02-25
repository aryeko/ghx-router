import type { ResultEnvelope, RouteSource } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { execute } from "@core/core/execute/execute.js"
import {
  type CliCapabilityId,
  runCliCapability,
} from "@core/core/execution/adapters/cli-capability-adapter.js"
import { runGraphqlCapability } from "@core/core/execution/adapters/graphql-capability-adapter.js"
import { normalizeError } from "@core/core/execution/normalizer.js"
import { preflightCheck } from "@core/core/execution/preflight.js"
import { getOperationCard } from "@core/core/registry/index.js"
import { routePreferenceOrder } from "@core/core/routing/policy.js"
import type { RouteReasonCode } from "@core/core/routing/reason-codes.js"
import { logger } from "@core/core/telemetry/log.js"
import { defaultCliRunner, detectCliEnvironmentCached } from "./cli-detect.js"
import type { ExecutionDeps } from "./types.js"

const DEFAULT_REASON: RouteReasonCode = "DEFAULT_POLICY"

export async function runSingleTask(
  task: string,
  input: Record<string, unknown>,
  deps: ExecutionDeps,
): Promise<ResultEnvelope> {
  const reason = deps.reason ?? DEFAULT_REASON
  const card = getOperationCard(task)
  if (!card) {
    logger.error("execute.unsupported_task", { task })
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Unsupported task: ${task}`,
        retryable: false,
      },
      routePreferenceOrder[0],
      { capabilityId: task, reason },
    )
  }

  logger.debug("execute.start", { capability_id: task })
  const startMs = Date.now()

  const cliRunner = deps.cliRunner ?? defaultCliRunner

  const result = await execute({
    card,
    params: input,
    routingContext: {
      ghCliAvailable: deps.ghCliAvailable,
      ghAuthenticated: deps.ghAuthenticated,
      githubTokenPresent: Boolean(deps.githubToken),
    },
    retry: {
      maxAttemptsPerRoute: 2,
    },
    preflight: async (route: RouteSource) => {
      const preflightInput: Parameters<typeof preflightCheck>[0] = { route }
      if (deps.githubToken !== undefined) {
        preflightInput.githubToken = deps.githubToken
      }

      if (route === "cli") {
        if (deps.ghCliAvailable !== undefined) {
          preflightInput.ghCliAvailable = deps.ghCliAvailable
        }

        if (deps.ghAuthenticated !== undefined) {
          preflightInput.ghAuthenticated = deps.ghAuthenticated
        }

        if (
          preflightInput.ghCliAvailable === undefined ||
          preflightInput.ghAuthenticated === undefined
        ) {
          if (deps.skipGhPreflight === true) {
            if (preflightInput.ghCliAvailable === undefined) {
              preflightInput.ghCliAvailable = true
            }

            if (preflightInput.ghAuthenticated === undefined) {
              preflightInput.ghAuthenticated = true
            }
          } else {
            const detected = await detectCliEnvironmentCached(cliRunner)

            if (preflightInput.ghCliAvailable === undefined) {
              preflightInput.ghCliAvailable = detected.ghCliAvailable
            }

            if (preflightInput.ghAuthenticated === undefined) {
              preflightInput.ghAuthenticated = detected.ghAuthenticated
            }
          }
        }
      }

      return preflightCheck(preflightInput)
    },
    routes: {
      graphql: async () => {
        return runGraphqlCapability(deps.githubClient, task, input)
      },
      cli: async () => {
        return runCliCapability(cliRunner, task as CliCapabilityId, input, card)
      },
      rest: async () =>
        normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: `Route 'rest' is not implemented for task '${task}'`,
            retryable: false,
            details: { route: "rest", task },
          },
          "rest",
          { capabilityId: task, reason },
        ),
    },
  })

  logger.info("execute.complete", {
    capability_id: task,
    ok: result.ok,
    route_used: result.meta?.route_used ?? null,
    duration_ms: Date.now() - startMs,
    error_code: result.error?.code ?? null,
  })

  return result
}
