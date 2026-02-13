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
    reason?: string
    pagination?: unknown
    timings?: unknown
  }
}
