import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { runSingleTask } from "./single.js"
import type { ClassifiedStep, ExecutionDeps } from "./types.js"

export function startCliSteps(
  steps: ReadonlyArray<ClassifiedStep>,
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Array<Promise<[number, ResultEnvelope]>> {
  return steps
    .filter((s) => s.route === "cli")
    .map((step) => {
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
      return runSingleTask(req.task, req.input, deps)
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
}

export async function collectCliResults(
  cliPromises: Array<Promise<[number, ResultEnvelope]>>,
  cliSteps: ReadonlyArray<ClassifiedStep>,
  requests: Array<{ task: string; input: Record<string, unknown> }>,
): Promise<Map<number, ResultEnvelope>> {
  const cliResults = new Map<number, ResultEnvelope>()
  const outcomes = await Promise.allSettled(cliPromises)

  for (let j = 0; j < cliSteps.length; j += 1) {
    const step = cliSteps[j]
    const outcome = outcomes[j]
    if (step === undefined || outcome === undefined) continue

    if (outcome.status === "fulfilled") {
      const [resolvedIndex, result] = outcome.value
      cliResults.set(resolvedIndex, result)
    } else {
      const msg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
      const req = requests[step.index]
      cliResults.set(step.index, {
        ok: false,
        error: { code: errorCodes.Unknown, message: msg, retryable: false },
        meta: { capability_id: req?.task ?? "unknown", route_used: "cli" },
      })
    }
  }

  return cliResults
}
