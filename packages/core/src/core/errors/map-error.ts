import type { ErrorCode } from "./codes.js"
import { errorCodes } from "./codes.js"

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function mapErrorToCode(error: unknown): ErrorCode {
  const message = toMessage(error).toLowerCase()

  if (
    message.includes("rate limit") ||
    /\b429\b/.test(message) ||
    message.includes("too many requests")
  ) {
    return errorCodes.RateLimit
  }

  if (/\b(500|502|503|504)\b/.test(message)) {
    return errorCodes.Server
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

  if (message.includes("not found") || /\b404\b/.test(message)) {
    return errorCodes.NotFound
  }

  if (message.includes("operation not available")) {
    return errorCodes.AdapterUnsupported
  }

  if (
    message.includes("auth") ||
    message.includes("forbidden") ||
    message.includes("unauthorized")
  ) {
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

  return errorCodes.Unknown
}
