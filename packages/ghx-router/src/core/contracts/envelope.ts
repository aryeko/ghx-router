import type { RouteReasonCode } from "../routing/reason-codes.js"

export type RouteSource = "cli" | "rest" | "graphql"

export interface ResultEnvelope<TData = unknown> {
  success: boolean
  data?: TData
  error?: {
    code: string
    message: string
    details?: unknown
    retryable?: boolean
  }
  meta: {
    source: RouteSource
    reason?: RouteReasonCode
    pagination?: unknown
    timings?: unknown
  }
}
