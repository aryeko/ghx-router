import type { ResultEnvelope } from "../contracts/envelope.js"
import type { RouteReasonCode } from "../routing/reason-codes.js"

function buildMeta(
  source: ResultEnvelope["meta"]["source"],
  reason?: RouteReasonCode
): ResultEnvelope["meta"] {
  return reason ? { source, reason } : { source }
}

export function normalizeResult<TData>(
  data: TData,
  source: ResultEnvelope["meta"]["source"],
  reason?: RouteReasonCode
): ResultEnvelope<TData> {
  return {
    success: true,
    data,
    meta: buildMeta(source, reason)
  }
}

export function normalizeError<TData = unknown>(
  error: NonNullable<ResultEnvelope["error"]>,
  source: ResultEnvelope["meta"]["source"],
  reason?: RouteReasonCode
): ResultEnvelope<TData> {
  return {
    success: false,
    error,
    meta: buildMeta(source, reason)
  }
}
