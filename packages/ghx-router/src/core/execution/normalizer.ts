import type { ResultEnvelope } from "../contracts/envelope.js"

export function normalizeResult<TData>(data: TData): ResultEnvelope<TData> {
  return {
    success: true,
    data,
    meta: {
      source: "cli"
    }
  }
}
