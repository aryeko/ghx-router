import type { ResultEnvelope } from "../../core/contracts/envelope.js"

type ExecuteTaskFn = (request: {
  task: string
  input: Record<string, unknown>
  options?: Record<string, unknown>
}) => Promise<ResultEnvelope>

export function createExecuteTool(deps: { executeTask: ExecuteTaskFn }) {
  return {
    execute(
      capabilityId: string,
      params: Record<string, unknown>,
      options?: Record<string, unknown>
    ): Promise<ResultEnvelope> {
      const request = {
        task: capabilityId,
        input: params,
        ...(options ? { options } : {})
      }

      return deps.executeTask({
        ...request
      })
    }
  }
}
