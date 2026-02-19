import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { isRetryableErrorCode } from "@core/core/errors/retryability.js"
import { normalizeError, normalizeResult } from "@core/core/execution/normalizer.js"
import { getGraphqlHandler } from "@core/gql/capability-registry.js"
import type { GithubClient } from "@core/gql/github-client.js"

export async function runGraphqlCapability(
  client: GithubClient,
  capabilityId: string,
  params: Record<string, unknown>,
): Promise<ResultEnvelope> {
  try {
    const handler = getGraphqlHandler(capabilityId)
    if (!handler) {
      return normalizeError(
        {
          code: errorCodes.AdapterUnsupported,
          message: `Unsupported GraphQL capability: ${capabilityId}`,
          retryable: false,
        },
        "graphql",
        { capabilityId, reason: "CAPABILITY_LIMIT" },
      )
    }
    const data = await handler(client, params)
    return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    const reason = code === errorCodes.AdapterUnsupported ? "CAPABILITY_LIMIT" : "CARD_PREFERRED"
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "graphql",
      { capabilityId, reason },
    )
  }
}
