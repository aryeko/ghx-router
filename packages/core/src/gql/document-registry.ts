import { IssueAssigneesAddDocument } from "./operations/issue-assignees-add.generated.js"
import { IssueAssigneesLookupDocument } from "./operations/issue-assignees-lookup.generated.js"
import { IssueAssigneesLookupByNumberDocument } from "./operations/issue-assignees-lookup-by-number.generated.js"
import { IssueAssigneesRemoveDocument } from "./operations/issue-assignees-remove.generated.js"
import { IssueAssigneesUpdateDocument } from "./operations/issue-assignees-update.generated.js"
import { IssueBlockedByAddDocument } from "./operations/issue-blocked-by-add.generated.js"
import { IssueBlockedByRemoveDocument } from "./operations/issue-blocked-by-remove.generated.js"
import { IssueCloseDocument } from "./operations/issue-close.generated.js"
import { IssueCommentCreateDocument } from "./operations/issue-comment-create.generated.js"
import { IssueCreateDocument } from "./operations/issue-create.generated.js"
import { IssueCreateRepositoryIdDocument } from "./operations/issue-create-repository-id.generated.js"
import { IssueDeleteDocument } from "./operations/issue-delete.generated.js"
import { IssueLabelsAddDocument } from "./operations/issue-labels-add.generated.js"
import { IssueLabelsLookupDocument } from "./operations/issue-labels-lookup.generated.js"
import { IssueLabelsLookupByNumberDocument } from "./operations/issue-labels-lookup-by-number.generated.js"
import { IssueLabelsRemoveDocument } from "./operations/issue-labels-remove.generated.js"
import { IssueLabelsUpdateDocument } from "./operations/issue-labels-update.generated.js"
import { IssueMilestoneLookupDocument } from "./operations/issue-milestone-lookup.generated.js"
import { IssueMilestoneLookupByNumberDocument } from "./operations/issue-milestone-lookup-by-number.generated.js"
import { IssueMilestoneSetDocument } from "./operations/issue-milestone-set.generated.js"
import { IssueNodeIdLookupDocument } from "./operations/issue-node-id-lookup.generated.js"
import { IssueParentLookupDocument } from "./operations/issue-parent-lookup.generated.js"
import { IssueParentRemoveDocument } from "./operations/issue-parent-remove.generated.js"
import { IssueParentSetDocument } from "./operations/issue-parent-set.generated.js"
import { IssueReopenDocument } from "./operations/issue-reopen.generated.js"
import { IssueUpdateDocument } from "./operations/issue-update.generated.js"
import { PrCommentReplyDocument } from "./operations/pr-comment-reply.generated.js"
import { PrCommentResolveDocument } from "./operations/pr-comment-resolve.generated.js"
import { PrCommentUnresolveDocument } from "./operations/pr-comment-unresolve.generated.js"
import { PrNodeIdDocument } from "./operations/pr-node-id.generated.js"
import { PrReviewSubmitDocument } from "./operations/pr-review-submit.generated.js"

// Resolution lookup queries (Phase 1)
const LOOKUP_DOCUMENTS: Record<string, string> = {
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
}

// Mutation documents for chaining (Phase 2)
const MUTATION_DOCUMENTS: Record<string, string> = {
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
  PrCommentReply: PrCommentReplyDocument,
  PrCommentResolve: PrCommentResolveDocument,
  PrCommentUnresolve: PrCommentUnresolveDocument,
  PrReviewSubmit: PrReviewSubmitDocument,
}

export function getLookupDocument(operationName: string): string {
  const doc = LOOKUP_DOCUMENTS[operationName]
  if (!doc) {
    throw new Error(`No lookup document registered for operation: ${operationName}`)
  }
  return doc
}

export function getMutationDocument(operationName: string): string {
  const doc = MUTATION_DOCUMENTS[operationName]
  if (!doc) {
    throw new Error(`No mutation document registered for operation: ${operationName}`)
  }
  return doc
}
