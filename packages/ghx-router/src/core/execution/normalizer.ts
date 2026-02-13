import type { ResultEnvelope } from "../contracts/envelope.js"
import type { RouteReasonCode } from "../routing/reason-codes.js"

type MetaInput = {
  capabilityId: string
  reason: RouteReasonCode | undefined
}

function buildMeta(
  route: "cli" | "rest" | "graphql",
  options: MetaInput
): ResultEnvelope["meta"] {
  const meta: ResultEnvelope["meta"] = {
    capability_id: options.capabilityId,
    route_used: route
  }

  if (options.reason !== undefined) {
    meta.reason = options.reason
  }

  return meta
}

export function normalizeResult<TData>(
  data: TData,
  route: "cli" | "rest" | "graphql",
  options: MetaInput
): ResultEnvelope<TData> {
  return {
    ok: true,
    data,
    meta: buildMeta(route, options)
  }
}

export function normalizeError<TData = unknown>(
  error: NonNullable<ResultEnvelope["error"]>,
  route: "cli" | "rest" | "graphql",
  options: MetaInput
): ResultEnvelope<TData> {
  return {
    ok: false,
    error,
    meta: buildMeta(route, options)
  }
}
