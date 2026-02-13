import { errorCodes } from "./codes.js"

const retryableCodes = new Set<string>([
  errorCodes.Timeout,
  errorCodes.InfraError
])

export function isRetryableErrorCode(code: string): boolean {
  return retryableCodes.has(code)
}
