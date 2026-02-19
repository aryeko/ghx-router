import { IssueAssigneesLookupDocument } from "./operations/issue-assignees-lookup.generated.js"
import { IssueAssigneesUpdateDocument } from "./operations/issue-assignees-update.generated.js"
import { IssueCreateDocument } from "./operations/issue-create.generated.js"
import { IssueCreateRepositoryIdDocument } from "./operations/issue-create-repository-id.generated.js"
import { IssueLabelsAddDocument } from "./operations/issue-labels-add.generated.js"
import { IssueLabelsLookupDocument } from "./operations/issue-labels-lookup.generated.js"
import { IssueLabelsUpdateDocument } from "./operations/issue-labels-update.generated.js"
import { IssueMilestoneLookupDocument } from "./operations/issue-milestone-lookup.generated.js"
import { IssueMilestoneSetDocument } from "./operations/issue-milestone-set.generated.js"
import { IssueParentLookupDocument } from "./operations/issue-parent-lookup.generated.js"
import { IssueParentRemoveDocument } from "./operations/issue-parent-remove.generated.js"

// Resolution lookup queries (Phase 1)
const LOOKUP_DOCUMENTS: Record<string, string> = {
  IssueLabelsLookup: IssueLabelsLookupDocument,
  IssueAssigneesLookup: IssueAssigneesLookupDocument,
  IssueMilestoneLookup: IssueMilestoneLookupDocument,
  IssueParentLookup: IssueParentLookupDocument,
  IssueCreateRepositoryId: IssueCreateRepositoryIdDocument,
}

// Mutation documents for chaining (Phase 2)
const MUTATION_DOCUMENTS: Record<string, string> = {
  IssueLabelsUpdate: IssueLabelsUpdateDocument,
  IssueLabelsAdd: IssueLabelsAddDocument,
  IssueAssigneesUpdate: IssueAssigneesUpdateDocument,
  IssueMilestoneSet: IssueMilestoneSetDocument,
  IssueParentRemove: IssueParentRemoveDocument,
  IssueCreate: IssueCreateDocument,
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
