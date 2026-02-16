import { errorCodes } from "./codes.js"

const retryableCodes = new Set<string>([
  errorCodes.Network,
  errorCodes.RateLimit,
  errorCodes.Server,
])

export function isRetryableErrorCode(code: string): boolean {
  return retryableCodes.has(code)
}
