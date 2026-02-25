import type {
  ChainResultEnvelope,
  ChainStepResult,
  ResultEnvelope,
} from "@core/core/contracts/envelope.js"
import type { TaskRequest } from "@core/core/contracts/task.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { logger } from "@core/core/telemetry/log.js"
import { executeBatch } from "./batch.js"
import { runSingleTask } from "./single.js"
import type { ExecutionDeps } from "./types.js"

export type { ExecutionDeps } from "./types.js"

export async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps,
): Promise<ResultEnvelope> {
  return runSingleTask(request.task, request.input as Record<string, unknown>, deps)
}

export async function executeTasks(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope> {
  logger.debug("execute_batch.start", { count: requests.length })

  if (requests.length === 0) {
    return {
      status: "failed",
      results: [],
      meta: { route_used: "graphql", total: 0, succeeded: 0, failed: 0 },
    }
  }

  if (requests.length === 1) {
    const req = requests[0]
    if (req === undefined) {
      return {
        status: "failed",
        results: [],
        meta: { route_used: "graphql", total: 0, succeeded: 0, failed: 0 },
      }
    }
    const batchStartMs = Date.now()
    const result = await runSingleTask(req.task, req.input, deps)

    const step: ChainStepResult = result.ok
      ? { task: req.task, ok: true, data: result.data }
      : {
          task: req.task,
          ok: false,
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
      meta: { route_used: routeUsed, total: 1, succeeded, failed: 1 - succeeded },
    }
  }

  return executeBatch(requests, deps)
}
