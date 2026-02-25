import type { ChainResultEnvelope, RouteSource } from "@core/core/contracts/envelope.js"
import type { TaskRequest } from "@core/core/contracts/task.js"
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

export async function executeFullRoute(
  request: TaskRequest,
  deps: ExecutionDeps,
): Promise<import("@core/core/contracts/envelope.js").ResultEnvelope> {
  const reason = deps.reason ?? DEFAULT_REASON
  const card = getOperationCard(request.task)
  if (!card) {
    logger.error("execute.unsupported_task", { task: request.task })
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Unsupported task: ${request.task}`,
        retryable: false,
      },
      routePreferenceOrder[0],
      { capabilityId: request.task, reason },
    )
  }

  logger.debug("execute.start", { capability_id: request.task })
  const startMs = Date.now()

  const cliRunner = deps.cliRunner ?? defaultCliRunner

  const result = await execute({
    card,
    params: request.input as Record<string, unknown>,
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
        return runGraphqlCapability(
          deps.githubClient,
          request.task,
          request.input as Record<string, unknown>,
        )
      },
      cli: async () => {
        return runCliCapability(
          cliRunner,
          request.task as CliCapabilityId,
          request.input as Record<string, unknown>,
          card,
        )
      },
      rest: async () =>
        normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: `Route 'rest' is not implemented for task '${request.task}'`,
            retryable: false,
            details: { route: "rest", task: request.task },
          },
          "rest",
          { capabilityId: request.task, reason },
        ),
    },
  })

  logger.info("execute.complete", {
    capability_id: request.task,
    ok: result.ok,
    route_used: result.meta?.route_used ?? null,
    duration_ms: Date.now() - startMs,
    error_code: result.error?.code ?? null,
  })

  return result
}

export async function executeSingle(
  request: { task: string; input: Record<string, unknown> },
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope> {
  const batchStartMs = Date.now()
  const result = await executeFullRoute({ task: request.task, input: request.input }, deps)

  const step = result.ok
    ? { task: request.task, ok: true as const, data: result.data }
    : {
        task: request.task,
        ok: false as const,
        error: result.error ?? {
          code: errorCodes.Unknown,
          message: "Unknown error",
          retryable: false,
        },
      }

  const succeeded = result.ok ? 1 : 0
  const routeUsed = result.meta?.route_used ?? "graphql"

  logger.info("execute_batch.complete", {
    ok: result.ok,
    status: result.ok ? "success" : "failed",
    total: 1,
    succeeded,
    failed: 1 - succeeded,
    duration_ms: Date.now() - batchStartMs,
  })

  return {
    status: result.ok ? "success" : "failed",
    results: [step],
    meta: {
      route_used: routeUsed,
      total: 1,
      succeeded,
      failed: 1 - succeeded,
    },
  }
}
