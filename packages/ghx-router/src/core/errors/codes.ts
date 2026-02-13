export const errorCodes = {
  Auth: "AUTH",
  NotFound: "NOT_FOUND",
  Validation: "VALIDATION",
  RateLimit: "RATE_LIMIT",
  Network: "NETWORK",
  Server: "SERVER",
  AdapterUnsupported: "ADAPTER_UNSUPPORTED",
  Unknown: "UNKNOWN"
} as const

export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes]
