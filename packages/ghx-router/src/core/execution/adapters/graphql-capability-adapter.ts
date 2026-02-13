import type {
  GithubClient,
  IssueListInput,
  IssueViewInput,
  PrListInput,
  PrViewInput,
  RepoViewInput
} from "../../../gql/client.js"
import { errorCodes } from "../../errors/codes.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import { normalizeError, normalizeResult } from "../normalizer.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"

export type GraphqlCapabilityId = "repo.view" | "issue.view" | "issue.list" | "pr.view" | "pr.list"

export async function runGraphqlCapability(
  client: Pick<GithubClient, "fetchRepoView" | "fetchIssueView" | "fetchIssueList" | "fetchPrView" | "fetchPrList">,
  capabilityId: GraphqlCapabilityId,
  params: Record<string, unknown>
): Promise<ResultEnvelope> {
  try {
    if (capabilityId === "repo.view") {
      const data = await client.fetchRepoView(params as RepoViewInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.view") {
      const data = await client.fetchIssueView(params as IssueViewInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.list") {
      const data = await client.fetchIssueList(params as IssueListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.view") {
      const data = await client.fetchPrView(params as PrViewInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.list") {
      const data = await client.fetchPrList(params as PrListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Unsupported GraphQL capability: ${capabilityId}`,
        retryable: false
      },
      "graphql",
      { capabilityId, reason: "CAPABILITY_LIMIT" }
    )
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code)
      },
      "graphql",
      { capabilityId, reason: "CARD_PREFERRED" }
    )
  }
}
