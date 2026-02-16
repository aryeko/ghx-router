import type {
  GithubClient,
  IssueAssigneesUpdateInput,
  IssueBlockedByInput,
  IssueCommentCreateInput,
  IssueCommentsListInput,
  IssueCreateInput,
  IssueLabelsUpdateInput,
  IssueLinkedPrsListInput,
  IssueListInput,
  IssueMilestoneSetInput,
  IssueMutationInput,
  IssueParentRemoveInput,
  IssueParentSetInput,
  IssueRelationsGetInput,
  IssueUpdateInput,
  IssueViewInput,
  PrCommentsListInput,
  PrDiffListFilesInput,
  PrListInput,
  PrReviewsListInput,
  PrViewInput,
  RepoViewInput,
} from "../../../gql/client.js"
import type { ResultEnvelope } from "../../contracts/envelope.js"
import { errorCodes } from "../../errors/codes.js"
import { mapErrorToCode } from "../../errors/map-error.js"
import { isRetryableErrorCode } from "../../errors/retryability.js"
import { normalizeError, normalizeResult } from "../normalizer.js"

export type GraphqlCapabilityId =
  | "repo.view"
  | "issue.view"
  | "issue.list"
  | "issue.comments.list"
  | "issue.create"
  | "issue.update"
  | "issue.close"
  | "issue.reopen"
  | "issue.delete"
  | "issue.labels.update"
  | "issue.assignees.update"
  | "issue.milestone.set"
  | "issue.comments.create"
  | "issue.linked_prs.list"
  | "issue.relations.get"
  | "issue.parent.set"
  | "issue.parent.remove"
  | "issue.blocked_by.add"
  | "issue.blocked_by.remove"
  | "pr.view"
  | "pr.list"
  | "pr.comments.list"
  | "pr.reviews.list"
  | "pr.diff.list_files"
  | "pr.comment.reply"
  | "pr.comment.resolve"
  | "pr.comment.unresolve"
  | "project_v2.org.get"
  | "project_v2.user.get"
  | "project_v2.fields.list"
  | "project_v2.items.list"
  | "project_v2.item.add_issue"
  | "project_v2.item.field.update"
  | "repo.issue_types.list"

const DEFAULT_LIST_FIRST = 30

function unsupportedGraphqlCapability(capabilityId: string): ResultEnvelope {
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

function withDefaultFirst(params: Record<string, unknown>): Record<string, unknown> {
  if (params.first === undefined) {
    return {
      ...params,
      first: DEFAULT_LIST_FIRST,
    }
  }

  return params
}

function requireNonEmptyString(
  params: Record<string, unknown>,
  field: string,
  capabilityId: GraphqlCapabilityId,
): string {
  const value = params[field]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing or invalid ${field} for ${capabilityId}`)
  }

  return value
}

export async function runGraphqlCapability(
  client: Pick<
    GithubClient,
    | "fetchRepoView"
    | "fetchIssueView"
    | "fetchIssueList"
    | "fetchIssueCommentsList"
    | "fetchPrView"
    | "fetchPrList"
    | "fetchPrCommentsList"
    | "fetchPrReviewsList"
    | "fetchPrDiffListFiles"
    | "replyToReviewThread"
    | "resolveReviewThread"
    | "unresolveReviewThread"
  > &
    Partial<
      Pick<
        GithubClient,
        | "createIssue"
        | "updateIssue"
        | "closeIssue"
        | "reopenIssue"
        | "deleteIssue"
        | "updateIssueLabels"
        | "updateIssueAssignees"
        | "setIssueMilestone"
        | "createIssueComment"
        | "fetchIssueLinkedPrs"
        | "fetchIssueRelations"
        | "setIssueParent"
        | "removeIssueParent"
        | "addIssueBlockedBy"
        | "removeIssueBlockedBy"
      >
    >,
  capabilityId: GraphqlCapabilityId,
  params: Record<string, unknown>,
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
      const data = await client.fetchIssueList(withDefaultFirst(params) as IssueListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.comments.list") {
      const data = await client.fetchIssueCommentsList(params as IssueCommentsListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.create") {
      if (!client.createIssue) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.createIssue(params as IssueCreateInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.update") {
      if (!client.updateIssue) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.updateIssue(params as IssueUpdateInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.close") {
      if (!client.closeIssue) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.closeIssue(params as IssueMutationInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.reopen") {
      if (!client.reopenIssue) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.reopenIssue(params as IssueMutationInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.delete") {
      if (!client.deleteIssue) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.deleteIssue(params as IssueMutationInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.labels.update") {
      if (!client.updateIssueLabels) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.updateIssueLabels(params as IssueLabelsUpdateInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.assignees.update") {
      if (!client.updateIssueAssignees) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.updateIssueAssignees(params as IssueAssigneesUpdateInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.milestone.set") {
      if (!client.setIssueMilestone) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.setIssueMilestone(params as IssueMilestoneSetInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.comments.create") {
      if (!client.createIssueComment) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.createIssueComment(params as IssueCommentCreateInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.linked_prs.list") {
      if (!client.fetchIssueLinkedPrs) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.fetchIssueLinkedPrs(params as IssueLinkedPrsListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.relations.get") {
      if (!client.fetchIssueRelations) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.fetchIssueRelations(params as IssueRelationsGetInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.parent.set") {
      if (!client.setIssueParent) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.setIssueParent(params as IssueParentSetInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.parent.remove") {
      if (!client.removeIssueParent) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.removeIssueParent(params as IssueParentRemoveInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.blocked_by.add") {
      if (!client.addIssueBlockedBy) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.addIssueBlockedBy(params as IssueBlockedByInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "issue.blocked_by.remove") {
      if (!client.removeIssueBlockedBy) {
        return unsupportedGraphqlCapability(capabilityId)
      }
      const data = await client.removeIssueBlockedBy(params as IssueBlockedByInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.view") {
      const data = await client.fetchPrView(params as PrViewInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.list") {
      const data = await client.fetchPrList(withDefaultFirst(params) as PrListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.comments.list") {
      const data = await client.fetchPrCommentsList(withDefaultFirst(params) as PrCommentsListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.reviews.list") {
      const data = await client.fetchPrReviewsList(withDefaultFirst(params) as PrReviewsListInput)
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.diff.list_files") {
      const data = await client.fetchPrDiffListFiles(
        withDefaultFirst(params) as PrDiffListFilesInput,
      )
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.comment.reply") {
      const threadId = requireNonEmptyString(params, "threadId", capabilityId)
      const body = requireNonEmptyString(params, "body", capabilityId)
      const data = await client.replyToReviewThread({ threadId, body })
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.comment.resolve") {
      const threadId = requireNonEmptyString(params, "threadId", capabilityId)
      const data = await client.resolveReviewThread({ threadId })
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    if (capabilityId === "pr.comment.unresolve") {
      const threadId = requireNonEmptyString(params, "threadId", capabilityId)
      const data = await client.unresolveReviewThread({ threadId })
      return normalizeResult(data, "graphql", { capabilityId, reason: "CARD_PREFERRED" })
    }

    return unsupportedGraphqlCapability(capabilityId)
  } catch (error: unknown) {
    const code = mapErrorToCode(error)
    return normalizeError(
      {
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: isRetryableErrorCode(code),
      },
      "graphql",
      { capabilityId, reason: "CARD_PREFERRED" },
    )
  }
}
