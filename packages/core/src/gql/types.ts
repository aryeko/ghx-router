import type { IssueCommentsListQueryVariables } from "./operations/issue-comments-list.generated.js"
import type { IssueListQueryVariables } from "./operations/issue-list.generated.js"
import type { IssueViewQueryVariables } from "./operations/issue-view.generated.js"
import type { PrDiffListFilesQueryVariables } from "./operations/pr-diff-list-files.generated.js"
import type { PrListQueryVariables } from "./operations/pr-list.generated.js"
import type { PrReviewSubmitMutationVariables } from "./operations/pr-review-submit.generated.js"
import type { PrReviewsListQueryVariables } from "./operations/pr-reviews-list.generated.js"
import type { PrViewQueryVariables } from "./operations/pr-view.generated.js"
import type { ProjectV2FieldsListQueryVariables } from "./operations/project-v2-fields-list.generated.js"
import type { ProjectV2ItemsListQueryVariables } from "./operations/project-v2-items-list.generated.js"
import type { ProjectV2OrgViewQueryVariables } from "./operations/project-v2-org-view.generated.js"
import type { ProjectV2UserViewQueryVariables } from "./operations/project-v2-user-view.generated.js"
import type { ReleaseListQueryVariables } from "./operations/release-list.generated.js"
import type { ReleaseViewQueryVariables } from "./operations/release-view.generated.js"
import type { RepoIssueTypesListQueryVariables } from "./operations/repo-issue-types-list.generated.js"
import type { RepoLabelsListQueryVariables } from "./operations/repo-labels-list.generated.js"
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
  owner: string
  name: string
  issueNumber: number
  title?: string
  body?: string
}

export type IssueMutationInput = {
  owner: string
  name: string
  issueNumber: number
}

export type IssueLabelsUpdateInput = {
  owner: string
  name: string
  issueNumber: number
  labels: string[]
}

export type IssueLabelsAddInput = {
  owner: string
  name: string
  issueNumber: number
  labels: string[]
}

export type IssueAssigneesUpdateInput = {
  owner: string
  name: string
  issueNumber: number
  assignees: string[]
}

export type IssueAssigneesAddInput = {
  owner: string
  name: string
  issueNumber: number
  assignees: string[]
}

export type IssueAssigneesRemoveInput = {
  owner: string
  name: string
  issueNumber: number
  assignees: string[]
}

export type IssueMilestoneSetInput = {
  owner: string
  name: string
  issueNumber: number
  milestoneNumber: number
}

export type IssueCommentCreateInput = {
  owner: string
  name: string
  issueNumber: number
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

export type IssueLabelsRemoveInput = {
  owner: string
  name: string
  issueNumber: number
  labels: string[]
}

export type IssueLabelsRemoveData = {
  issueNumber: number
  removed: string[]
}

export type IssueAssigneesUpdateData = {
  id: string
  assignees: string[]
}

export type IssueAssigneesAddData = {
  id: string
  assignees: string[]
}

export type IssueAssigneesRemoveData = {
  id: string
  assignees: string[]
}

export type IssueMilestoneSetData = {
  id: string
  milestoneNumber: number | null
}

export type IssueMilestoneClearInput = {
  owner: string
  name: string
  issueNumber: number
}

export type IssueMilestoneClearData = {
  issueNumber: number
  cleared: boolean
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
  startLine?: number
  startSide?: "LEFT" | "RIGHT"
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

export type RepoLabelsListInput = RepoLabelsListQueryVariables
export type RepoLabelItemData = {
  id: string | null
  name: string | null
  description: string | null
  color: string | null
  isDefault: boolean | null
}
export type RepoLabelsListData = {
  items: RepoLabelItemData[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

export type RepoIssueTypesListInput = RepoIssueTypesListQueryVariables
export type RepoIssueTypeItemData = {
  id: string | null
  name: string | null
  color: string | null
  isEnabled: boolean | null
}
export type RepoIssueTypesListData = {
  items: RepoIssueTypeItemData[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

export type ReleaseViewInput = ReleaseViewQueryVariables
export type ReleaseViewData = {
  id: number | null
  tagName: string
  name: string | null
  isDraft: boolean
  isPrerelease: boolean
  url: string | null
  targetCommitish: string | null
  createdAt: string | null
  publishedAt: string | null
}

export type ReleaseListInput = ReleaseListQueryVariables
export type ReleaseItemData = ReleaseViewData
export type ReleaseListData = {
  items: ReleaseItemData[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

export type ProjectV2OrgViewInput = ProjectV2OrgViewQueryVariables
export type ProjectV2OrgViewData = {
  id: string | null
  title: string | null
  shortDescription: string | null
  public: boolean | null
  closed: boolean | null
  url: string | null
}

export type ProjectV2UserViewInput = ProjectV2UserViewQueryVariables
export type ProjectV2UserViewData = ProjectV2OrgViewData

export type ProjectV2FieldsListInput = ProjectV2FieldsListQueryVariables
export type ProjectV2FieldItemData = {
  id: string | null
  name: string | null
  dataType: string | null
  options?: Array<{ id: string; name: string }> | null
}
export type ProjectV2FieldsListData = {
  items: ProjectV2FieldItemData[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

export type ProjectV2ItemsListInput = ProjectV2ItemsListQueryVariables
export type ProjectV2ItemData = {
  id: string | null
  contentType: string | null
  contentNumber: number | null
  contentTitle: string | null
}
export type ProjectV2ItemsListData = {
  items: ProjectV2ItemData[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}

// PR mutations
export type PrCreateInput = {
  owner: string
  name: string
  baseRefName: string
  headRefName: string
  title: string
  body?: string
  draft?: boolean
}

export type PrCreateData = {
  number: number
  url: string
  title: string
  state: string
  draft: boolean
}

export type PrUpdateInput = {
  owner: string
  name: string
  prNumber: number
  title?: string
  body?: string
  draft?: boolean // handled by CLI adapter only — not supported in UpdatePullRequestInput GQL mutation
}

export type PrUpdateData = {
  number: number
  url: string
  title: string
  state: string
  draft: boolean
}

export type PrMergeInput = {
  owner: string
  name: string
  prNumber: number
  mergeMethod?: string // MERGE | SQUASH | REBASE
  deleteBranch?: boolean
}

export type PrMergeData = {
  prNumber: number
  method: string
  isMethodAssumed: boolean
  queued: boolean
  deleteBranch: boolean
}

export type PrBranchUpdateInput = {
  owner: string
  name: string
  prNumber: number
  updateMethod?: string // MERGE | REBASE
}

export type PrBranchUpdateData = {
  prNumber: number
  updated: boolean
}

export type PrAssigneesInput = {
  owner: string
  name: string
  prNumber: number
  assignees: string[]
}
export type PrAssigneesAddInput = PrAssigneesInput
export type PrAssigneesRemoveInput = PrAssigneesInput

export type PrAssigneesAddData = {
  prNumber: number
  added: string[]
}

export type PrAssigneesRemoveData = {
  prNumber: number
  removed: string[]
}

export type PrReviewsRequestInput = {
  owner: string
  name: string
  prNumber: number
  reviewers: string[]
}

export type PrReviewsRequestData = {
  prNumber: number
  reviewers: string[]
  updated: boolean
}

// Project V2 mutations
export type ProjectV2ItemAddInput = {
  owner: string
  projectNumber: number
  issueUrl: string
}

export type ProjectV2ItemAddData = {
  itemId: string
  itemType: string | null
}

export type ProjectV2ItemRemoveInput = {
  owner: string
  projectNumber: number
  itemId: string
}

export type ProjectV2ItemRemoveData = {
  deletedItemId: string
}

export type ProjectV2ItemFieldUpdateInput = {
  projectId: string
  itemId: string
  fieldId: string
  valueText?: string
  valueNumber?: number
  valueDate?: string
  valueSingleSelectOptionId?: string
  valueIterationId?: string
  clear?: boolean
}

export type ProjectV2ItemFieldUpdateData = {
  itemId: string
}
