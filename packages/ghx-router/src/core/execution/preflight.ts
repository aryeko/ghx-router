import type { RouteSource } from "../contracts/envelope.js"
import type { ErrorCode } from "../errors/codes.js"
import { errorCodes } from "../errors/codes.js"

export type PreflightInput = {
  route: RouteSource
  githubToken?: string | null
  ghCliAvailable?: boolean
  ghAuthenticated?: boolean
}

export type PreflightResult =
  | { ok: true }
  | {
      ok: false
      code: ErrorCode
      message: string
      retryable: boolean
      details: { route: RouteSource }
    }

export function preflightCheck(input: PreflightInput): PreflightResult {
  if (input.route === "rest") {
    return {
      ok: false,
      code: errorCodes.AdapterUnsupported,
      message: "REST route is planned but not implemented in v1",
      retryable: false,
      details: { route: input.route }
    }
  }

  if (input.route === "cli" && input.ghCliAvailable === false) {
    return {
      ok: false,
      code: errorCodes.Validation,
      message: "GitHub CLI is required for cli route",
      retryable: false,
      details: { route: input.route }
    }
  }

  if (input.route === "cli" && input.ghAuthenticated === false) {
    return {
      ok: false,
      code: errorCodes.Auth,
      message: "GitHub CLI authentication is required for cli route",
      retryable: false,
      details: { route: input.route }
    }
  }

  if (input.route === "graphql") {
    const token = input.githubToken?.trim()
    if (!token) {
      return {
        ok: false,
        code: errorCodes.Auth,
        message: "GitHub token is required for graphql route",
        retryable: false,
        details: { route: input.route }
      }
    }
  }

  return { ok: true }
}
