import { errorCodes } from "./codes.js"
import type { ErrorCode } from "./codes.js"

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function mapErrorToCode(error: unknown): ErrorCode {
  const message = toMessage(error).toLowerCase()

  if (message.includes("rate limit") || message.includes(" 429") || message.includes("too many requests")) {
    return errorCodes.RateLimit
  }

  if (message.includes("timeout")) {
    return errorCodes.Network
  }

  if (
    message.includes("econn") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("network") ||
    message.includes("connection reset")
  ) {
    return errorCodes.Network
  }

  if (message.includes(" 500") || message.includes(" 502") || message.includes(" 503") || message.includes(" 504")) {
    return errorCodes.Server
  }

  if (message.includes("auth") || message.includes("forbidden") || message.includes("unauthorized")) {
    return errorCodes.Auth
  }

  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("positive integer")
  ) {
    return errorCodes.Validation
  }

  if (message.includes("not found") || message.includes(" 404")) {
    return errorCodes.NotFound
  }

  return errorCodes.Unknown
}
