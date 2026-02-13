import { errorCodes } from "./codes.js"

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function mapErrorToCode(error: unknown): string {
  const message = toMessage(error).toLowerCase()

  if (
    message.includes("econn") ||
    message.includes("enotfound") ||
    message.includes("eai_again") ||
    message.includes("network") ||
    message.includes("connection reset") ||
    message.includes("rate limit") ||
    message.includes(" 429") ||
    message.includes(" 502") ||
    message.includes(" 503") ||
    message.includes(" 504")
  ) {
    return errorCodes.InfraError
  }

  if (message.includes("auth") || message.includes("forbidden") || message.includes("unauthorized")) {
    return errorCodes.AuthFailed
  }

  if (message.includes("timeout")) {
    return errorCodes.Timeout
  }

  if (message.includes("graphql")) {
    return errorCodes.GraphqlExecutionFailed
  }

  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("positive integer")
  ) {
    return errorCodes.ValidationFailed
  }

  return errorCodes.Unknown
}
