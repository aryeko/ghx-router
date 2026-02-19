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
  PrReviewsListInput,
  PrViewInput,
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
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)
  ) {
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
  assertNonEmptyString(input.issueId, "Issue id")
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
  assertNonEmptyString(input.issueId, "Issue id")
}

export function assertIssueLabelsUpdateInput(input: IssueLabelsUpdateInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertStringArray(input.labels, "Labels")
}

export function assertIssueLabelsAddInput(input: IssueLabelsAddInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertStringArray(input.labels, "Labels")
}

export function assertIssueAssigneesUpdateInput(input: IssueAssigneesUpdateInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertStringArray(input.assignees, "Assignees")
}

export function assertIssueMilestoneSetInput(input: IssueMilestoneSetInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  if (
    input.milestoneNumber !== null &&
    (!Number.isInteger(input.milestoneNumber) || input.milestoneNumber <= 0)
  ) {
    throw new Error("Milestone number must be a positive integer or null")
  }
}

export function assertIssueCommentCreateInput(input: IssueCommentCreateInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertNonEmptyString(input.body, "Issue comment body")
}

export function assertIssueLinkedPrsListInput(input: IssueLinkedPrsListInput): void {
  assertIssueInput(input)
}

export function assertIssueRelationsGetInput(input: IssueRelationsGetInput): void {
  assertIssueInput(input)
}

export function assertIssueParentSetInput(input: IssueParentSetInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertNonEmptyString(input.parentIssueId, "Parent issue id")
}

export function assertIssueParentRemoveInput(input: IssueParentRemoveInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
}

export function assertIssueBlockedByInput(input: IssueBlockedByInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
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
