import { errorCodes } from "./codes.js"

function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function mapErrorToCode(error: unknown): string {
  const message = toMessage(error).toLowerCase()

  if (message.includes("auth") || message.includes("forbidden") || message.includes("unauthorized")) {
    return errorCodes.AuthFailed
  }

  if (message.includes("timeout")) {
    return errorCodes.Timeout
  }

  if (message.includes("graphql")) {
    return errorCodes.GraphqlExecutionFailed
  }

  if (message.includes("validation") || message.includes("invalid")) {
    return errorCodes.ValidationFailed
  }

  return errorCodes.Unknown
}
