import type { RouteSource } from "../contracts/envelope.js"
import { errorCodes } from "../errors/codes.js"

export type PreflightInput = {
  route: RouteSource
  githubToken?: string | null
}

export type PreflightResult =
  | { ok: true }
  | {
      ok: false
      code: string
      message: string
      retryable: boolean
      details: { route: RouteSource }
    }

export function preflightCheck(input: PreflightInput): PreflightResult {
  if (input.route === "graphql") {
    const token = input.githubToken?.trim()
    if (!token) {
      return {
        ok: false,
        code: errorCodes.AuthFailed,
        message: "GitHub token is required for graphql route",
        retryable: false,
        details: { route: input.route }
      }
    }
  }

  return { ok: true }
}
