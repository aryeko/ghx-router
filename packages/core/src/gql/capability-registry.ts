import type { GithubClient } from "./github-client.js"
import type {
  IssueAssigneesAddInput,
  IssueAssigneesRemoveInput,
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
  PrAssigneesAddInput,
  PrAssigneesRemoveInput,
  PrBranchUpdateInput,
  PrCommentsListInput,
  PrDiffListFilesInput,
  PrListInput,
  PrMergeStatusInput,
  ProjectV2FieldsListInput,
  ProjectV2ItemAddInput,
  ProjectV2ItemFieldUpdateInput,
  ProjectV2ItemRemoveInput,
  ProjectV2ItemsListInput,
  ProjectV2OrgViewInput,
  ProjectV2UserViewInput,
  PrReviewSubmitInput,
  PrReviewsListInput,
  PrReviewsRequestInput,
  PrUpdateInput,
  PrViewInput,
  ReleaseListInput,
  ReleaseViewInput,
  RepoIssueTypesListInput,
  RepoLabelsListInput,
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
    "issue.assignees.add",
    (c, p) => {
      if (!c.addIssueAssignees) {
        throw new Error("addIssueAssignees operation not available")
      }
      return c.addIssueAssignees(p as IssueAssigneesAddInput)
    },
  ],
  [
    "issue.assignees.remove",
    (c, p) => {
      if (!c.removeIssueAssignees) {
        throw new Error("removeIssueAssignees operation not available")
      }
      return c.removeIssueAssignees(p as IssueAssigneesRemoveInput)
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
  ["repo.labels.list", (c, p) => c.fetchRepoLabelsList(withDefaultFirst(p) as RepoLabelsListInput)],
  [
    "repo.issue_types.list",
    (c, p) => c.fetchRepoIssueTypesList(withDefaultFirst(p) as RepoIssueTypesListInput),
  ],
  // Release
  ["release.view", (c, p) => c.fetchReleaseView(p as ReleaseViewInput)],
  ["release.list", (c, p) => c.fetchReleaseList(withDefaultFirst(p) as ReleaseListInput)],

  // Project V2
  ["project_v2.org.view", (c, p) => c.fetchProjectV2OrgView(p as ProjectV2OrgViewInput)],
  ["project_v2.user.view", (c, p) => c.fetchProjectV2UserView(p as ProjectV2UserViewInput)],
  [
    "project_v2.fields.list",
    (c, p) => c.fetchProjectV2FieldsList(withDefaultFirst(p) as ProjectV2FieldsListInput),
  ],
  [
    "project_v2.items.list",
    (c, p) => {
      const params = p as Record<string, unknown>
      const paramsWithFirst = params.first === undefined ? { ...params, first: 100 } : params
      return c.fetchProjectV2ItemsList(paramsWithFirst as ProjectV2ItemsListInput)
    },
  ],

  // PR mutations (Phase 2)
  [
    "pr.create",
    (c, p) => {
      if (!c.createPr) throw new Error("createPr operation not available")
      const raw = p as {
        owner: string
        name: string
        title: string
        head: string
        base: string
        body?: string
        draft?: boolean
      }
      return c.createPr({
        owner: raw.owner,
        name: raw.name,
        title: raw.title,
        headRefName: raw.head,
        baseRefName: raw.base,
        ...(raw.body !== undefined ? { body: raw.body } : {}),
        ...(raw.draft !== undefined ? { draft: raw.draft } : {}),
      })
    },
  ],
  [
    "pr.update",
    (c, p) => {
      if (!c.updatePr) throw new Error("updatePr operation not available")
      return c.updatePr(p as PrUpdateInput)
    },
  ],
  [
    "pr.merge",
    (c, p) => {
      if (!c.mergePr) throw new Error("mergePr operation not available")
      const raw = p as {
        owner: string
        name: string
        prNumber: number
        method?: string
        deleteBranch?: boolean
      }
      const methodMap: Record<string, string> = {
        merge: "MERGE",
        squash: "SQUASH",
        rebase: "REBASE",
      }
      const mergeMethod = raw.method !== undefined ? methodMap[raw.method.toLowerCase()] : undefined
      if (raw.method !== undefined && !mergeMethod) {
        throw new Error(
          `Unsupported merge method "${raw.method}" for pr.merge. Expected one of: merge, squash, rebase.`,
        )
      }
      return c.mergePr({
        owner: raw.owner,
        name: raw.name,
        prNumber: raw.prNumber,
        ...(mergeMethod !== undefined ? { mergeMethod } : {}),
        ...(raw.deleteBranch !== undefined ? { deleteBranch: raw.deleteBranch } : {}),
      })
    },
  ],
  [
    "pr.branch.update",
    (c, p) => {
      if (!c.updatePrBranch) throw new Error("updatePrBranch operation not available")
      return c.updatePrBranch(p as PrBranchUpdateInput)
    },
  ],
  [
    "pr.assignees.add",
    (c, p) => {
      if (!c.addPrAssignees) throw new Error("addPrAssignees operation not available")
      return c.addPrAssignees(p as PrAssigneesAddInput)
    },
  ],
  [
    "pr.assignees.remove",
    (c, p) => {
      if (!c.removePrAssignees) throw new Error("removePrAssignees operation not available")
      return c.removePrAssignees(p as PrAssigneesRemoveInput)
    },
  ],
  [
    "pr.reviews.request",
    (c, p) => {
      if (!c.requestPrReviews) throw new Error("requestPrReviews operation not available")
      return c.requestPrReviews(p as PrReviewsRequestInput)
    },
  ],

  // Project V2 mutations (Phase 2)
  [
    "project_v2.items.issue.add",
    (c, p) => {
      if (!c.addProjectV2Item) throw new Error("addProjectV2Item operation not available")
      return c.addProjectV2Item(p as ProjectV2ItemAddInput)
    },
  ],
  [
    "project_v2.items.issue.remove",
    (c, p) => {
      if (!c.removeProjectV2Item) throw new Error("removeProjectV2Item operation not available")
      return c.removeProjectV2Item(p as ProjectV2ItemRemoveInput)
    },
  ],
  [
    "project_v2.items.field.update",
    (c, p) => {
      if (!c.updateProjectV2ItemField)
        throw new Error("updateProjectV2ItemField operation not available")
      return c.updateProjectV2ItemField(p as ProjectV2ItemFieldUpdateInput)
    },
  ],
])

export function getGraphqlHandler(capabilityId: string): GraphqlHandler | undefined {
  return handlers.get(capabilityId)
}

export function listGraphqlCapabilities(): string[] {
  return [...handlers.keys()]
}
