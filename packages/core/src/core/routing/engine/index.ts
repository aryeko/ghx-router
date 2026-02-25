import type { ChainResultEnvelope, ResultEnvelope } from "@core/core/contracts/envelope.js"
import type { TaskRequest } from "@core/core/contracts/task.js"
import { logger } from "@core/core/telemetry/log.js"
import { executeBatch } from "./batch.js"
import { executeFullRoute, executeSingle } from "./single.js"
import type { ExecutionDeps } from "./types.js"

export type { ExecutionDeps } from "./types.js"

export async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps,
): Promise<ResultEnvelope> {
  return executeFullRoute(request, deps)
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

  // Filter out undefined elements for the single-item path
  const defined = requests.filter(
    (r): r is { task: string; input: Record<string, unknown> } => r !== undefined,
  )

  if (defined.length === 0) {
    return {
      status: "failed",
      results: [],
      meta: { route_used: "graphql", total: 0, succeeded: 0, failed: 0 },
    }
  }

  if (defined.length === 1 && requests.length === 1 && defined[0] !== undefined) {
    return executeSingle(defined[0], deps)
  }

  return executeBatch(requests, deps)
}
