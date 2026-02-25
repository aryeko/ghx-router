import type { ChainResultEnvelope, ResultEnvelope } from "../../core/contracts/envelope.js"

export type CompactRunResult =
  | { ok: true; data: unknown; pagination?: ResultEnvelope["meta"]["pagination"] }
  | { ok: false; error: { code: string; message: string } }

export type CompactChainStepResult =
  | { task: string; ok: true }
  | { task: string; ok: false; error: { code: string; message: string } }

export type CompactChainResult = {
  status: ChainResultEnvelope["status"]
  results: CompactChainStepResult[]
}

export function compactRunResult(envelope: ResultEnvelope): CompactRunResult {
  if (envelope.ok) {
    return envelope.meta.pagination !== undefined
      ? { ok: true, data: envelope.data, pagination: envelope.meta.pagination }
      : { ok: true, data: envelope.data }
  }
  const err = envelope.error
  return {
    ok: false,
    error: {
      code: err?.code ?? "UNKNOWN",
      message: err?.message ?? "",
    },
  }
}

export function compactChainResult(envelope: ChainResultEnvelope): CompactChainResult {
  return {
    status: envelope.status,
    results: envelope.results.map((step) => {
      if (step.ok) {
        return { task: step.task, ok: true as const }
      }
      return {
        task: step.task,
        ok: false as const,
        error: {
          code: step.error?.code ?? "UNKNOWN",
          message: step.error?.message ?? "",
        },
      }
    }),
  }
}
