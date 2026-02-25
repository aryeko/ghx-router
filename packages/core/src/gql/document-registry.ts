import { IssueAssigneesAddDocument } from "./operations/issue-assignees-add.generated.js"
import { IssueAssigneesLookupDocument } from "./operations/issue-assignees-lookup.generated.js"
import { IssueAssigneesLookupByNumberDocument } from "./operations/issue-assignees-lookup-by-number.generated.js"
import { IssueAssigneesRemoveDocument } from "./operations/issue-assignees-remove.generated.js"
import { IssueAssigneesUpdateDocument } from "./operations/issue-assignees-update.generated.js"
import { IssueBlockedByAddDocument } from "./operations/issue-blocked-by-add.generated.js"
import { IssueBlockedByRemoveDocument } from "./operations/issue-blocked-by-remove.generated.js"
import { IssueCloseDocument } from "./operations/issue-close.generated.js"
import { IssueCommentCreateDocument } from "./operations/issue-comment-create.generated.js"
import { IssueCommentsListDocument } from "./operations/issue-comments-list.generated.js"
import { IssueCreateDocument } from "./operations/issue-create.generated.js"
import { IssueCreateRepositoryIdDocument } from "./operations/issue-create-repository-id.generated.js"
import { IssueDeleteDocument } from "./operations/issue-delete.generated.js"
import { IssueLabelsAddDocument } from "./operations/issue-labels-add.generated.js"
import { IssueLabelsLookupDocument } from "./operations/issue-labels-lookup.generated.js"
import { IssueLabelsLookupByNumberDocument } from "./operations/issue-labels-lookup-by-number.generated.js"
import { IssueLabelsRemoveDocument } from "./operations/issue-labels-remove.generated.js"
import { IssueLabelsUpdateDocument } from "./operations/issue-labels-update.generated.js"
import { IssueLinkedPrsListDocument } from "./operations/issue-linked-prs-list.generated.js"
import { IssueListDocument } from "./operations/issue-list.generated.js"
import { IssueMilestoneLookupDocument } from "./operations/issue-milestone-lookup.generated.js"
import { IssueMilestoneLookupByNumberDocument } from "./operations/issue-milestone-lookup-by-number.generated.js"
import { IssueMilestoneSetDocument } from "./operations/issue-milestone-set.generated.js"
import { IssueNodeIdLookupDocument } from "./operations/issue-node-id-lookup.generated.js"
import { IssueParentLookupDocument } from "./operations/issue-parent-lookup.generated.js"
import { IssueParentRemoveDocument } from "./operations/issue-parent-remove.generated.js"
import { IssueParentSetDocument } from "./operations/issue-parent-set.generated.js"
import { IssueRelationsGetDocument } from "./operations/issue-relations-get.generated.js"
import { IssueReopenDocument } from "./operations/issue-reopen.generated.js"
import { IssueUpdateDocument } from "./operations/issue-update.generated.js"
import { IssueViewDocument } from "./operations/issue-view.generated.js"
import { PrAssigneesAddDocument } from "./operations/pr-assignees-add.generated.js"
import { PrAssigneesRemoveDocument } from "./operations/pr-assignees-remove.generated.js"
import { PrBranchUpdateDocument } from "./operations/pr-branch-update.generated.js"
import { PrCommentReplyDocument } from "./operations/pr-comment-reply.generated.js"
import { PrCommentResolveDocument } from "./operations/pr-comment-resolve.generated.js"
import { PrCommentUnresolveDocument } from "./operations/pr-comment-unresolve.generated.js"
import { PrCommentsListDocument } from "./operations/pr-comments-list.generated.js"
import { PrCreateDocument } from "./operations/pr-create.generated.js"
import { PrDiffListFilesDocument } from "./operations/pr-diff-list-files.generated.js"
import { PrListDocument } from "./operations/pr-list.generated.js"
import { PrMergeDocument } from "./operations/pr-merge.generated.js"
import { PrMergeStatusDocument } from "./operations/pr-merge-status.generated.js"
import { PrNodeIdDocument } from "./operations/pr-node-id.generated.js"
import { PrReviewSubmitDocument } from "./operations/pr-review-submit.generated.js"
import { PrReviewsListDocument } from "./operations/pr-reviews-list.generated.js"
import { PrReviewsRequestDocument } from "./operations/pr-reviews-request.generated.js"
import { PrUpdateDocument } from "./operations/pr-update.generated.js"
import { PrViewDocument } from "./operations/pr-view.generated.js"
import { ProjectV2FieldsListOrgDocument } from "./operations/project-v2-fields-list-org.generated.js"
import { AddProjectV2ItemDocument } from "./operations/project-v2-item-add.generated.js"
import { UpdateProjectV2ItemFieldDocument } from "./operations/project-v2-item-field-update.generated.js"
import { RemoveProjectV2ItemDocument } from "./operations/project-v2-item-remove.generated.js"
import { ProjectV2ItemsListOrgDocument } from "./operations/project-v2-items-list-org.generated.js"
import { ProjectV2OrgViewDocument } from "./operations/project-v2-org-view.generated.js"
import { ProjectV2UserViewDocument } from "./operations/project-v2-user-view.generated.js"
import { ReleaseListDocument } from "./operations/release-list.generated.js"
import { ReleaseViewDocument } from "./operations/release-view.generated.js"
import { RepoIssueTypesListDocument } from "./operations/repo-issue-types-list.generated.js"
import { RepoLabelsListDocument } from "./operations/repo-labels-list.generated.js"
import { RepoViewDocument } from "./operations/repo-view.generated.js"
import { UserNodeIdDocument } from "./operations/user-node-id.generated.js"

// Unified document map — contains lookup queries, mutations, and query operations
const DOCUMENTS: Record<string, string> = {
  // Resolution lookup queries (Phase 1)
  IssueAssigneesLookup: IssueAssigneesLookupDocument,
  IssueAssigneesLookupByNumber: IssueAssigneesLookupByNumberDocument,
  IssueCreateRepositoryId: IssueCreateRepositoryIdDocument,
  IssueLabelsLookup: IssueLabelsLookupDocument,
  IssueLabelsLookupByNumber: IssueLabelsLookupByNumberDocument,
  IssueMilestoneLookup: IssueMilestoneLookupDocument,
  IssueMilestoneLookupByNumber: IssueMilestoneLookupByNumberDocument,
  IssueNodeIdLookup: IssueNodeIdLookupDocument,
  IssueParentLookup: IssueParentLookupDocument,
  PrNodeId: PrNodeIdDocument,
  UserNodeId: UserNodeIdDocument,

  // Mutation documents
  IssueAssigneesAdd: IssueAssigneesAddDocument,
  IssueAssigneesRemove: IssueAssigneesRemoveDocument,
  IssueAssigneesUpdate: IssueAssigneesUpdateDocument,
  IssueBlockedByAdd: IssueBlockedByAddDocument,
  IssueBlockedByRemove: IssueBlockedByRemoveDocument,
  IssueClose: IssueCloseDocument,
  IssueCommentCreate: IssueCommentCreateDocument,
  IssueCreate: IssueCreateDocument,
  IssueDelete: IssueDeleteDocument,
  IssueLabelsAdd: IssueLabelsAddDocument,
  IssueLabelsRemove: IssueLabelsRemoveDocument,
  IssueLabelsUpdate: IssueLabelsUpdateDocument,
  IssueMilestoneSet: IssueMilestoneSetDocument,
  IssueParentRemove: IssueParentRemoveDocument,
  IssueParentSet: IssueParentSetDocument,
  IssueReopen: IssueReopenDocument,
  IssueUpdate: IssueUpdateDocument,
  PrAssigneesAdd: PrAssigneesAddDocument,
  PrAssigneesRemove: PrAssigneesRemoveDocument,
  PrBranchUpdate: PrBranchUpdateDocument,
  PrCommentReply: PrCommentReplyDocument,
  PrCommentResolve: PrCommentResolveDocument,
  PrCommentUnresolve: PrCommentUnresolveDocument,
  PrCreate: PrCreateDocument,
  PrMerge: PrMergeDocument,
  PrReviewSubmit: PrReviewSubmitDocument,
  PrReviewsRequest: PrReviewsRequestDocument,
  PrUpdate: PrUpdateDocument,
  AddProjectV2Item: AddProjectV2ItemDocument,
  RemoveProjectV2Item: RemoveProjectV2ItemDocument,
  UpdateProjectV2ItemField: UpdateProjectV2ItemFieldDocument,

  // Query documents
  IssueView: IssueViewDocument,
  IssueList: IssueListDocument,
  IssueCommentsList: IssueCommentsListDocument,
  IssueRelationsGet: IssueRelationsGetDocument,
  IssueLinkedPrsList: IssueLinkedPrsListDocument,
  PrView: PrViewDocument,
  PrList: PrListDocument,
  PrDiffListFiles: PrDiffListFilesDocument,
  PrMergeStatus: PrMergeStatusDocument,
  PrCommentsList: PrCommentsListDocument,
  PrReviewsList: PrReviewsListDocument,
  RepoView: RepoViewDocument,
  RepoLabelsList: RepoLabelsListDocument,
  RepoIssueTypesList: RepoIssueTypesListDocument,
  ReleaseView: ReleaseViewDocument,
  ReleaseList: ReleaseListDocument,
  ProjectV2OrgView: ProjectV2OrgViewDocument,
  ProjectV2UserView: ProjectV2UserViewDocument,
  ProjectV2FieldsListOrg: ProjectV2FieldsListOrgDocument,
  ProjectV2ItemsListOrg: ProjectV2ItemsListOrgDocument,
}

export function getDocument(operationName: string): string {
  const doc = DOCUMENTS[operationName]
  if (!doc) {
    throw new Error(`No document registered for operation: ${operationName}`)
  }
  return doc
}

export function getLookupDocument(operationName: string): string {
  return getDocument(operationName)
}

export function getMutationDocument(operationName: string): string {
  return getDocument(operationName)
}
