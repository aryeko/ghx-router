import type { GithubClient } from "./github-client.js"
import type {
  IssueAssigneesUpdateInput,
  IssueBlockedByInput,
  IssueCommentCreateInput,
  IssueCommentsListInput,
  IssueCreateInput,
  IssueLabelsAddInput,
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
  PrMergeStatusInput,
  PrReviewSubmitInput,
  PrReviewsListInput,
  PrViewInput,
  RepoViewInput,
} from "./types.js"

export type GraphqlHandler = (
  client: GithubClient,
  params: Record<string, unknown>,
) => Promise<unknown>

const DEFAULT_LIST_FIRST = 30

function withDefaultFirst(params: Record<string, unknown>): Record<string, unknown> {
  if (params.first === undefined) {
    return { ...params, first: DEFAULT_LIST_FIRST }
  }
  return params
}

function requireNonEmptyString(
  params: Record<string, unknown>,
  field: string,
  capabilityId: string,
): string {
  const value = params[field]
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Missing or invalid ${field} for ${capabilityId}`)
  }
  return value
}

const handlers = new Map<string, GraphqlHandler>([
  // Repo
  ["repo.view", (c, p) => c.fetchRepoView(p as RepoViewInput)],

  // Issue queries
  ["issue.view", (c, p) => c.fetchIssueView(p as IssueViewInput)],
  ["issue.list", (c, p) => c.fetchIssueList(withDefaultFirst(p) as IssueListInput)],
  ["issue.comments.list", (c, p) => c.fetchIssueCommentsList(p as IssueCommentsListInput)],

  // Issue mutations
  [
    "issue.create",
    (c, p) => {
      if (!c.createIssue) {
        throw new Error("createIssue operation not available")
      }
      return c.createIssue(p as IssueCreateInput)
    },
  ],
  [
    "issue.update",
    (c, p) => {
      if (!c.updateIssue) {
        throw new Error("updateIssue operation not available")
      }
      return c.updateIssue(p as IssueUpdateInput)
    },
  ],
  [
    "issue.close",
    (c, p) => {
      if (!c.closeIssue) {
        throw new Error("closeIssue operation not available")
      }
      return c.closeIssue(p as IssueMutationInput)
    },
  ],
  [
    "issue.reopen",
    (c, p) => {
      if (!c.reopenIssue) {
        throw new Error("reopenIssue operation not available")
      }
      return c.reopenIssue(p as IssueMutationInput)
    },
  ],
  [
    "issue.delete",
    (c, p) => {
      if (!c.deleteIssue) {
        throw new Error("deleteIssue operation not available")
      }
      return c.deleteIssue(p as IssueMutationInput)
    },
  ],
  [
    "issue.labels.add",
    (c, p) => {
      if (!c.addIssueLabels) {
        throw new Error("addIssueLabels operation not available")
      }
      return c.addIssueLabels(p as IssueLabelsAddInput)
    },
  ],
  [
    "issue.labels.set",
    (c, p) => {
      if (!c.updateIssueLabels) {
        throw new Error("updateIssueLabels operation not available")
      }
      return c.updateIssueLabels(p as IssueLabelsUpdateInput)
    },
  ],
  [
    "issue.assignees.set",
    (c, p) => {
      if (!c.updateIssueAssignees) {
        throw new Error("updateIssueAssignees operation not available")
      }
      return c.updateIssueAssignees(p as IssueAssigneesUpdateInput)
    },
  ],
  [
    "issue.milestone.set",
    (c, p) => {
      if (!c.setIssueMilestone) {
        throw new Error("setIssueMilestone operation not available")
      }
      return c.setIssueMilestone(p as IssueMilestoneSetInput)
    },
  ],
  [
    "issue.comments.create",
    (c, p) => {
      if (!c.createIssueComment) {
        throw new Error("createIssueComment operation not available")
      }
      return c.createIssueComment(p as IssueCommentCreateInput)
    },
  ],
  [
    "issue.relations.prs.list",
    (c, p) => {
      if (!c.fetchIssueLinkedPrs) {
        throw new Error("fetchIssueLinkedPrs operation not available")
      }
      return c.fetchIssueLinkedPrs(p as IssueLinkedPrsListInput)
    },
  ],
  [
    "issue.relations.view",
    (c, p) => {
      if (!c.fetchIssueRelations) {
        throw new Error("fetchIssueRelations operation not available")
      }
      return c.fetchIssueRelations(p as IssueRelationsGetInput)
    },
  ],
  [
    "issue.relations.parent.set",
    (c, p) => {
      if (!c.setIssueParent) {
        throw new Error("setIssueParent operation not available")
      }
      return c.setIssueParent(p as IssueParentSetInput)
    },
  ],
  [
    "issue.relations.parent.remove",
    (c, p) => {
      if (!c.removeIssueParent) {
        throw new Error("removeIssueParent operation not available")
      }
      return c.removeIssueParent(p as IssueParentRemoveInput)
    },
  ],
  [
    "issue.relations.blocked_by.add",
    (c, p) => {
      if (!c.addIssueBlockedBy) {
        throw new Error("addIssueBlockedBy operation not available")
      }
      return c.addIssueBlockedBy(p as IssueBlockedByInput)
    },
  ],
  [
    "issue.relations.blocked_by.remove",
    (c, p) => {
      if (!c.removeIssueBlockedBy) {
        throw new Error("removeIssueBlockedBy operation not available")
      }
      return c.removeIssueBlockedBy(p as IssueBlockedByInput)
    },
  ],

  // PR queries
  ["pr.view", (c, p) => c.fetchPrView(p as PrViewInput)],
  ["pr.list", (c, p) => c.fetchPrList(withDefaultFirst(p) as PrListInput)],
  ["pr.reviews.list", (c, p) => c.fetchPrReviewsList(withDefaultFirst(p) as PrReviewsListInput)],
  ["pr.diff.files", (c, p) => c.fetchPrDiffListFiles(withDefaultFirst(p) as PrDiffListFilesInput)],
  ["pr.merge.status", (c, p) => c.fetchPrMergeStatus(p as PrMergeStatusInput)],
  ["pr.threads.list", (c, p) => c.fetchPrCommentsList(withDefaultFirst(p) as PrCommentsListInput)],

  // PR mutations
  [
    "pr.threads.reply",
    (c, p) => {
      const threadId = requireNonEmptyString(p, "threadId", "pr.threads.reply")
      const body = requireNonEmptyString(p, "body", "pr.threads.reply")
      return c.replyToReviewThread({ threadId, body })
    },
  ],
  [
    "pr.threads.resolve",
    (c, p) => {
      const threadId = requireNonEmptyString(p, "threadId", "pr.threads.resolve")
      return c.resolveReviewThread({ threadId })
    },
  ],
  [
    "pr.threads.unresolve",
    (c, p) => {
      const threadId = requireNonEmptyString(p, "threadId", "pr.threads.unresolve")
      return c.unresolveReviewThread({ threadId })
    },
  ],
  [
    "pr.reviews.submit",
    (c, p) => {
      if (!c.submitPrReview) {
        throw new Error("submitPrReview operation not available")
      }
      return c.submitPrReview(p as PrReviewSubmitInput)
    },
  ],
])

export function getGraphqlHandler(capabilityId: string): GraphqlHandler | undefined {
  return handlers.get(capabilityId)
}

export function listGraphqlCapabilities(): string[] {
  return [...handlers.keys()]
}
