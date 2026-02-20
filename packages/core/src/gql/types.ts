import type { IssueCommentsListQueryVariables } from "./operations/issue-comments-list.generated.js"
import type { IssueListQueryVariables } from "./operations/issue-list.generated.js"
import type { IssueViewQueryVariables } from "./operations/issue-view.generated.js"
import type { PrDiffListFilesQueryVariables } from "./operations/pr-diff-list-files.generated.js"
import type { PrListQueryVariables } from "./operations/pr-list.generated.js"
import type { PrReviewSubmitMutationVariables } from "./operations/pr-review-submit.generated.js"
import type { PrReviewsListQueryVariables } from "./operations/pr-reviews-list.generated.js"
import type { PrViewQueryVariables } from "./operations/pr-view.generated.js"
import type { RepoViewQueryVariables } from "./operations/repo-view.generated.js"

export type RepoViewInput = RepoViewQueryVariables
export type IssueCommentsListInput = IssueCommentsListQueryVariables
export type IssueListInput = IssueListQueryVariables
export type IssueViewInput = IssueViewQueryVariables
export type PrListInput = PrListQueryVariables
export type PrViewInput = PrViewQueryVariables
export type PrReviewsListInput = PrReviewsListQueryVariables
export type PrDiffListFilesInput = PrDiffListFilesQueryVariables

export type PrCommentsListInput = {
  owner: string
  name: string
  prNumber: number
  first: number
  after?: string | null
  unresolvedOnly?: boolean
  includeOutdated?: boolean
}

export type IssueCreateInput = {
  owner: string
  name: string
  title: string
  body?: string
}

export type IssueUpdateInput = {
  issueId: string
  title?: string
  body?: string
}

export type IssueMutationInput = {
  issueId: string
}

export type IssueLabelsUpdateInput = {
  issueId: string
  labels: string[]
}

export type IssueLabelsAddInput = {
  issueId: string
  labels: string[]
}

export type IssueAssigneesUpdateInput = {
  issueId: string
  assignees: string[]
}

export type IssueMilestoneSetInput = {
  issueId: string
  milestoneNumber: number
}

export type IssueCommentCreateInput = {
  issueId: string
  body: string
}

export type IssueLinkedPrsListInput = {
  owner: string
  name: string
  issueNumber: number
}

export type IssueRelationsGetInput = IssueLinkedPrsListInput

export type IssueParentSetInput = {
  issueId: string
  parentIssueId: string
}

export type IssueParentRemoveInput = {
  issueId: string
}

export type IssueBlockedByInput = {
  issueId: string
  blockedByIssueId: string
}

export type RepoViewData = {
  id: string
  name: string
  nameWithOwner: string
  isPrivate: boolean
  stargazerCount: number
  forkCount: number
  url: string
  defaultBranch: string | null
}

export type IssueViewData = {
  id: string
  number: number
  title: string
  state: string
  url: string
  body: string
  labels: string[]
}

export type IssueListItemData = {
  id: string
  number: number
  title: string
  state: string
  url: string
}

export type IssueListData = {
  items: Array<IssueListItemData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type IssueCommentData = {
  id: string
  body: string
  authorLogin: string | null
  createdAt: string
  url: string
}

export type IssueCommentsListData = {
  items: Array<IssueCommentData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type IssueMutationData = {
  id: string
  number: number
  title?: string
  state?: string
  url?: string
  closed?: boolean
  reopened?: boolean
  deleted?: boolean
}

export type IssueLabelsUpdateData = {
  id: string
  labels: string[]
}

export type IssueLabelsAddData = {
  id: string
  labels: string[]
}

export type IssueAssigneesUpdateData = {
  id: string
  assignees: string[]
}

export type IssueMilestoneSetData = {
  id: string
  milestoneNumber: number | null
}

export type IssueCommentCreateData = {
  id: string
  body: string
  url: string
}

export type IssueLinkedPrData = {
  id: string
  number: number
  title: string
  state: string
  url: string
}

export type IssueLinkedPrsListData = {
  items: Array<IssueLinkedPrData>
}

export type IssueRelationNodeData = {
  id: string
  number: number
}

export type IssueRelationsGetData = {
  issue: IssueRelationNodeData
  parent: IssueRelationNodeData | null
  children: Array<IssueRelationNodeData>
  blockedBy: Array<IssueRelationNodeData>
}

export type IssueParentSetData = {
  issueId: string
  parentIssueId: string
  updated: boolean
}

export type IssueParentRemoveData = {
  issueId: string
  parentRemoved: boolean
}

export type IssueBlockedByData = {
  issueId: string
  blockedByIssueId: string
  added?: boolean
  removed?: boolean
}

export type PrViewData = {
  id: string
  number: number
  title: string
  state: string
  url: string
  body: string
  labels: string[]
}

export type PrListItemData = {
  id: string
  number: number
  title: string
  state: string
  url: string
}

export type PrListData = {
  items: Array<PrListItemData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type PrReviewThreadCommentData = {
  id: string
  authorLogin: string | null
  body: string
  createdAt: string
  url: string
}

export type PrReviewThreadData = {
  id: string
  path: string | null
  line: number | null
  startLine: number | null
  diffSide: string | null
  subjectType: string | null
  isResolved: boolean
  isOutdated: boolean
  viewerCanReply: boolean
  viewerCanResolve: boolean
  viewerCanUnresolve: boolean
  resolvedByLogin: string | null
  comments: Array<PrReviewThreadCommentData>
}

export type PrCommentsListData = {
  items: Array<PrReviewThreadData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
  filterApplied: {
    unresolvedOnly: boolean
    includeOutdated: boolean
  }
  scan: {
    pagesScanned: number
    sourceItemsScanned: number
    scanTruncated: boolean
  }
}

export type PrReviewData = {
  id: string
  authorLogin: string | null
  body: string
  state: string
  submittedAt: string | null
  url: string
  commitOid: string | null
}

export type PrReviewsListData = {
  items: Array<PrReviewData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type PrDiffFileData = {
  path: string
  additions: number
  deletions: number
}

export type PrDiffListFilesData = {
  items: Array<PrDiffFileData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type PrMergeStatusInput = {
  owner: string
  name: string
  prNumber: number
}

export type PrMergeStatusData = {
  mergeable: string | null
  mergeStateStatus: string | null
  reviewDecision: string | null
  isDraft: boolean
  state: string
}

export type ReviewThreadMutationInput = {
  threadId: string
}

export type ReplyToReviewThreadInput = ReviewThreadMutationInput & {
  body: string
}

export type ReviewThreadMutationData = {
  id: string
  isResolved: boolean
}

export type ReplyToReviewThreadData = ReviewThreadMutationData & {
  commentId: string
  commentUrl: string
}

export type DraftComment = {
  path: string
  body: string
  line: number
  side?: "LEFT" | "RIGHT"
}

export type PrReviewSubmitInput = {
  owner: string
  name: string
  prNumber: number
  event: PrReviewSubmitMutationVariables["event"]
  body?: string
  comments?: DraftComment[]
}

export type PrReviewSubmitData = {
  id: string
  state: string
  url: string
  body: string | null
}
