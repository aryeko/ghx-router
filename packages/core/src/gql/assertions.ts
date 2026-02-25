import type {
  DraftComment,
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
  PrCreateInput,
  PrDiffListFilesInput,
  PrListInput,
  PrMergeInput,
  ProjectV2OrgViewInput,
  ProjectV2UserViewInput,
  PrReviewSubmitInput,
  PrReviewsListInput,
  PrReviewsRequestInput,
  PrUpdateInput,
  PrViewInput,
  ReleaseViewInput,
  ReplyToReviewThreadInput,
  RepoViewInput,
  ReviewThreadMutationInput,
} from "./types.js"

export function assertRepoInput(input: RepoViewInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
}

export function assertIssueInput(input: IssueViewInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.issueNumber) || input.issueNumber <= 0) {
    throw new Error("Issue number must be a positive integer")
  }
}

export function assertIssueListInput(input: IssueListInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
}

export function assertIssueCommentsListInput(input: IssueCommentsListInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.issueNumber) || input.issueNumber <= 0) {
    throw new Error("Issue number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
  if (input.after !== undefined && input.after !== null && typeof input.after !== "string") {
    throw new Error("After cursor must be a string")
  }
}

export function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`)
  }

  return value
}

export function assertOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`)
  }

  return value
}

export function assertStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of non-empty strings`)
  }

  if (value.length === 0) {
    throw new Error(`${fieldName} must not be empty`)
  }

  if (value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new Error(`${fieldName} must be an array of non-empty strings`)
  }

  return value
}

export function assertIssueCreateInput(input: IssueCreateInput): void {
  assertRepoInput({ owner: input.owner, name: input.name })
  assertNonEmptyString(input.title, "Issue title")
  assertOptionalString(input.body, "Issue body")
}

export function assertIssueUpdateInput(input: IssueUpdateInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
  if (input.title === undefined && input.body === undefined) {
    throw new Error("Issue update requires at least one field")
  }
  if (input.title !== undefined) {
    assertOptionalString(input.title, "Issue title")
  }
  if (input.body !== undefined) {
    assertOptionalString(input.body, "Issue body")
  }
}

export function assertIssueMutationInput(input: IssueMutationInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
}

export function assertIssueLabelsUpdateInput(input: IssueLabelsUpdateInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
  assertStringArray(input.labels, "Labels")
}

export function assertIssueLabelsAddInput(input: IssueLabelsAddInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
  assertStringArray(input.labels, "Labels")
}

export function assertIssueAssigneesUpdateInput(input: IssueAssigneesUpdateInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
  assertStringArray(input.assignees, "Assignees")
}

export function assertIssueAssigneesAddInput(input: IssueAssigneesAddInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
  assertStringArray(input.assignees, "Assignees")
}

export function assertIssueAssigneesRemoveInput(input: IssueAssigneesRemoveInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
  assertStringArray(input.assignees, "Assignees")
}

export function assertIssueMilestoneSetInput(input: IssueMilestoneSetInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
  if (!Number.isInteger(input.milestoneNumber) || input.milestoneNumber <= 0) {
    throw new Error("Milestone number must be a positive integer")
  }
}

export function assertIssueCommentCreateInput(input: IssueCommentCreateInput): void {
  assertIssueInput({ owner: input.owner, name: input.name, issueNumber: input.issueNumber })
  assertNonEmptyString(input.body, "Issue comment body")
}

export function assertIssueLinkedPrsListInput(input: IssueLinkedPrsListInput): void {
  assertIssueInput(input)
}

export function assertIssueRelationsGetInput(input: IssueRelationsGetInput): void {
  assertIssueInput(input)
}

export function assertIssueParentSetInput(input: IssueParentSetInput): void {
  assertNonEmptyString(input.issueId, "Issue id")
  assertNonEmptyString(input.parentIssueId, "Parent issue id")
}

export function assertIssueParentRemoveInput(input: IssueParentRemoveInput): void {
  assertNonEmptyString(input.issueId, "Issue id")
}

export function assertIssueBlockedByInput(input: IssueBlockedByInput): void {
  assertNonEmptyString(input.issueId, "Issue id")
  assertNonEmptyString(input.blockedByIssueId, "Blocked-by issue id")
}

export function assertPrInput(input: PrViewInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
}

export function assertPrListInput(input: PrListInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
}

export function assertPrReviewsListInput(input: PrReviewsListInput): void {
  if (
    typeof input.owner !== "string" ||
    typeof input.name !== "string" ||
    input.owner.trim().length === 0 ||
    input.name.trim().length === 0
  ) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
}

export function assertPrDiffListFilesInput(input: PrDiffListFilesInput): void {
  if (
    typeof input.owner !== "string" ||
    typeof input.name !== "string" ||
    input.owner.trim().length === 0 ||
    input.name.trim().length === 0
  ) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
}

export function assertPrCommentsListInput(input: PrCommentsListInput): void {
  if (
    typeof input.owner !== "string" ||
    typeof input.name !== "string" ||
    input.owner.trim().length === 0 ||
    input.name.trim().length === 0
  ) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
  if (input.unresolvedOnly !== undefined && typeof input.unresolvedOnly !== "boolean") {
    throw new Error("unresolvedOnly must be a boolean")
  }
  if (input.includeOutdated !== undefined && typeof input.includeOutdated !== "boolean") {
    throw new Error("includeOutdated must be a boolean")
  }
  if (input.after !== undefined && input.after !== null && typeof input.after !== "string") {
    throw new Error("After cursor must be a string")
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function assertReviewThreadInput(input: ReviewThreadMutationInput): void {
  if (typeof input.threadId !== "string" || input.threadId.trim().length === 0) {
    throw new Error("Review thread id is required")
  }
}

export function assertReplyToReviewThreadInput(input: ReplyToReviewThreadInput): void {
  assertReviewThreadInput(input)
  if (typeof input.body !== "string" || input.body.trim().length === 0) {
    throw new Error("Reply body is required")
  }
}

export function assertRepoAndPaginationInput(input: {
  owner: string
  name: string
  first: number
}): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.first) || input.first <= 0 || input.first > 100) {
    throw new Error("List page size must be a positive integer between 1 and 100")
  }
}

export function assertReleaseViewInput(input: ReleaseViewInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (typeof input.tagName !== "string" || input.tagName.trim().length === 0) {
    throw new Error("Release tag name is required")
  }
}

export function assertProjectInput(input: {
  owner: string
  projectNumber: number
  first?: number
}): void {
  assertNonEmptyString(input.owner, "Project owner")
  if (!Number.isInteger(input.projectNumber) || input.projectNumber <= 0) {
    throw new Error("Project number must be a positive integer")
  }
  if (
    input.first !== undefined &&
    (!Number.isInteger(input.first) || input.first < 1 || input.first > 100)
  ) {
    throw new Error("`first` must be an integer between 1 and 100")
  }
}

export function assertProjectOrgInput(input: ProjectV2OrgViewInput): void {
  if (input.org.trim().length === 0) {
    throw new Error("Organization name is required")
  }
  if (!Number.isInteger(input.projectNumber) || input.projectNumber <= 0) {
    throw new Error("Project number must be a positive integer")
  }
}

export function assertProjectUserInput(input: ProjectV2UserViewInput): void {
  if (input.user.trim().length === 0) {
    throw new Error("User login is required")
  }
  if (!Number.isInteger(input.projectNumber) || input.projectNumber <= 0) {
    throw new Error("Project number must be a positive integer")
  }
}

export function assertPrCreateInput(input: PrCreateInput): void {
  assertRepoInput({ owner: input.owner, name: input.name })
  assertNonEmptyString(input.title, "PR title")
  assertNonEmptyString(input.headRefName, "Head branch name")
  assertNonEmptyString(input.baseRefName, "Base branch name")
  assertOptionalString(input.body, "PR body")
  if (input.draft !== undefined && typeof input.draft !== "boolean") {
    throw new Error("draft must be a boolean")
  }
}

export function assertPrUpdateInput(input: PrUpdateInput): void {
  assertPrInput({ owner: input.owner, name: input.name, prNumber: input.prNumber })
  if (input.title === undefined && input.body === undefined && input.draft === undefined) {
    throw new Error("At least one of title, body, or draft must be provided")
  }
  assertOptionalString(input.title, "PR title")
  assertOptionalString(input.body, "PR body")
  if (input.draft !== undefined && typeof input.draft !== "boolean") {
    throw new Error("draft must be a boolean")
  }
}

const VALID_MERGE_METHODS = new Set(["MERGE", "SQUASH", "REBASE"])
const VALID_BRANCH_UPDATE_METHODS = new Set(["MERGE", "REBASE"])

export function assertPrMergeInput(input: PrMergeInput): void {
  assertPrInput({ owner: input.owner, name: input.name, prNumber: input.prNumber })
  if (input.mergeMethod !== undefined && !VALID_MERGE_METHODS.has(input.mergeMethod)) {
    throw new Error(
      `mergeMethod "${input.mergeMethod}" is invalid. Expected one of: MERGE, SQUASH, REBASE`,
    )
  }
  if (input.deleteBranch !== undefined && typeof input.deleteBranch !== "boolean") {
    throw new Error("deleteBranch must be a boolean")
  }
}

export function assertPrBranchUpdateInput(input: PrBranchUpdateInput): void {
  assertPrInput({ owner: input.owner, name: input.name, prNumber: input.prNumber })
  if (input.updateMethod !== undefined && !VALID_BRANCH_UPDATE_METHODS.has(input.updateMethod)) {
    throw new Error(
      `updateMethod "${input.updateMethod}" is invalid. Expected one of: MERGE, REBASE`,
    )
  }
}

export function assertPrAssigneesInput(input: PrAssigneesAddInput | PrAssigneesRemoveInput): void {
  assertPrInput({ owner: input.owner, name: input.name, prNumber: input.prNumber })
  assertStringArray(input.assignees, "Assignees")
}

export function assertPrReviewsRequestInput(input: PrReviewsRequestInput): void {
  assertPrInput({ owner: input.owner, name: input.name, prNumber: input.prNumber })
  assertStringArray(input.reviewers, "Reviewers")
}

const VALID_REVIEW_EVENTS = new Set(["APPROVE", "COMMENT", "REQUEST_CHANGES"])

function assertDraftComment(comment: unknown, index: number): void {
  if (typeof comment !== "object" || comment === null) {
    throw new Error(`comments[${index}] must be an object`)
  }
  const c = comment as DraftComment
  assertNonEmptyString(c.path, `comments[${index}].path`)
  assertNonEmptyString(c.body, `comments[${index}].body`)
  if (!Number.isInteger(c.line) || c.line <= 0) {
    throw new Error(`comments[${index}].line must be a positive integer`)
  }
}

export function assertPrReviewSubmitInput(input: PrReviewSubmitInput): void {
  assertNonEmptyString(input.owner, "Repository owner")
  assertNonEmptyString(input.name, "Repository name")
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!input.event || typeof input.event !== "string") {
    throw new Error("Review event is required")
  }
  if (!VALID_REVIEW_EVENTS.has(input.event)) {
    throw new Error(
      `event "${input.event}" is invalid. Expected one of: APPROVE, COMMENT, REQUEST_CHANGES`,
    )
  }
  assertOptionalString(input.body, "Review body")
  if (input.comments !== undefined) {
    if (!Array.isArray(input.comments)) {
      throw new Error("comments must be an array")
    }
    input.comments.forEach((c, i) => assertDraftComment(c, i))
  }
}
