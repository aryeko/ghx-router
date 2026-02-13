import type { RouteReasonCode } from "../routing/reason-codes.js"
import type { ErrorCode } from "../errors/codes.js"

export type RouteSource = "cli" | "rest" | "graphql"

export interface ResultError {
  code: ErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export interface AttemptMeta {
  route: RouteSource
  status: "success" | "error" | "skipped"
  error_code?: ErrorCode
  duration_ms?: number
}

export interface ResultMeta {
  capability_id: string
  route_used?: RouteSource
  reason?: RouteReasonCode
  attempts?: AttemptMeta[]
  pagination?: {
    has_next_page?: boolean
    end_cursor?: string
    next?: unknown
  }
  timings?: {
    total_ms?: number
    adapter_ms?: number
  }
  cost?: {
    tokens_in?: number
    tokens_out?: number
  }
}

export interface ResultEnvelope<TData = unknown> {
  ok: boolean
  data?: TData
  error?: ResultError
  meta: ResultMeta
}
