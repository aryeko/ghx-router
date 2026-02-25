import {
  asRecord,
  assertIssueAssigneesAddInput,
  assertIssueAssigneesRemoveInput,
  assertIssueAssigneesUpdateInput,
  assertIssueBlockedByInput,
  assertIssueCommentCreateInput,
  assertIssueCommentsListInput,
  assertIssueCreateInput,
  assertIssueInput,
  assertIssueLabelsAddInput,
  assertIssueLabelsUpdateInput,
  assertIssueLinkedPrsListInput,
  assertIssueListInput,
  assertIssueMilestoneSetInput,
  assertIssueMutationInput,
  assertIssueParentRemoveInput,
  assertIssueParentSetInput,
  assertIssueRelationsGetInput,
  assertIssueUpdateInput,
  assertNonEmptyString,
  assertOptionalString,
  assertPrAssigneesInput,
  assertPrBranchUpdateInput,
  assertPrCommentsListInput,
  assertPrCreateInput,
  assertPrDiffListFilesInput,
  assertPrInput,
  assertPrListInput,
  assertPrMergeInput,
  assertProjectInput,
  assertProjectOrgInput,
  assertProjectUserInput,
  assertPrReviewSubmitInput,
  assertPrReviewsListInput,
  assertPrReviewsRequestInput,
  assertPrUpdateInput,
  assertReleaseViewInput,
  assertReplyToReviewThreadInput,
  assertRepoAndPaginationInput,
  assertRepoInput,
  assertReviewThreadInput,
  assertStringArray,
} from "@core/gql/assertions.js"
import type { DraftComment } from "@core/gql/types.js"
import { describe, expect, it } from "vitest"

// --- assertNonEmptyString ---

describe("assertNonEmptyString", () => {
  it("throws when value is not a string", () => {
    expect(() => assertNonEmptyString(42, "Field")).toThrow("Field is required")
  })

  it("throws when value is an empty string", () => {
    expect(() => assertNonEmptyString("", "Title")).toThrow("Title is required")
  })

  it("throws when value is a whitespace-only string", () => {
    expect(() => assertNonEmptyString("   ", "Name")).toThrow("Name is required")
  })

  it("returns the value when it is a valid non-empty string", () => {
    expect(assertNonEmptyString("hello", "Field")).toBe("hello")
  })

  it("throws when value is null", () => {
    expect(() => assertNonEmptyString(null, "Field")).toThrow("Field is required")
  })

  it("throws when value is a boolean", () => {
    expect(() => assertNonEmptyString(false, "Flag")).toThrow("Flag is required")
  })
})

// --- assertOptionalString ---

describe("assertOptionalString", () => {
  it("returns undefined when value is undefined", () => {
    expect(assertOptionalString(undefined, "Field")).toBeUndefined()
  })

  it("throws when value is a number", () => {
    expect(() => assertOptionalString(123, "Body")).toThrow("Body must be a string")
  })

  it("throws when value is a boolean", () => {
    expect(() => assertOptionalString(true, "Flag")).toThrow("Flag must be a string")
  })

  it("returns the string when value is a valid string", () => {
    expect(assertOptionalString("ok", "Body")).toBe("ok")
  })

  it("returns empty string when value is an empty string", () => {
    expect(assertOptionalString("", "Body")).toBe("")
  })
})

// --- assertStringArray ---

describe("assertStringArray", () => {
  it("throws when value is not an array", () => {
    expect(() => assertStringArray("not-array", "Labels")).toThrow(
      "Labels must be an array of non-empty strings",
    )
  })

  it("throws when value is an empty array", () => {
    expect(() => assertStringArray([], "Labels")).toThrow("Labels must not be empty")
  })

  it("throws when array contains an empty string", () => {
    expect(() => assertStringArray(["valid", ""], "Tags")).toThrow(
      "Tags must be an array of non-empty strings",
    )
  })

  it("throws when array contains a whitespace-only string", () => {
    expect(() => assertStringArray(["valid", "  "], "Tags")).toThrow(
      "Tags must be an array of non-empty strings",
    )
  })

  it("throws when array contains a non-string entry", () => {
    expect(() => assertStringArray(["valid", 42], "Tags")).toThrow(
      "Tags must be an array of non-empty strings",
    )
  })

  it("returns the array when all entries are valid", () => {
    const arr = ["bug", "feature"]
    expect(assertStringArray(arr, "Labels")).toBe(arr)
  })
})

// --- assertIssueListInput ---

describe("assertIssueListInput", () => {
  const base = { owner: "acme", name: "repo" }

  it("throws when first is zero", () => {
    expect(() => assertIssueListInput({ ...base, first: 0 })).toThrow(
      "List page size must be a positive integer",
    )
  })

  it("throws when first is negative", () => {
    expect(() => assertIssueListInput({ ...base, first: -5 })).toThrow(
      "List page size must be a positive integer",
    )
  })

  it("throws when first is a non-integer", () => {
    expect(() => assertIssueListInput({ ...base, first: 1.5 })).toThrow(
      "List page size must be a positive integer",
    )
  })
})

// --- assertIssueCommentsListInput ---

describe("assertIssueCommentsListInput", () => {
  const base = { owner: "acme", name: "repo", issueNumber: 1, first: 10 }

  it("throws when first is zero", () => {
    expect(() => assertIssueCommentsListInput({ ...base, first: 0 })).toThrow(
      "List page size must be a positive integer",
    )
  })

  it("throws when after cursor is a number", () => {
    expect(() =>
      assertIssueCommentsListInput({ ...base, after: 123 as unknown as string }),
    ).toThrow("After cursor must be a string")
  })

  it("does not throw when after cursor is a string", () => {
    expect(() => assertIssueCommentsListInput({ ...base, after: "cursor-abc" })).not.toThrow()
  })

  it("does not throw when after cursor is undefined", () => {
    expect(() => assertIssueCommentsListInput({ ...base })).not.toThrow()
  })

  it("does not throw when after cursor is null", () => {
    expect(() =>
      assertIssueCommentsListInput({ ...base, after: null as unknown as string }),
    ).not.toThrow()
  })
})

// --- assertIssueUpdateInput ---

describe("assertIssueUpdateInput", () => {
  const base = { owner: "acme", name: "repo", issueNumber: 1 }

  it("throws when neither title nor body is provided", () => {
    expect(() => assertIssueUpdateInput(base)).toThrow("Issue update requires at least one field")
  })

  it("does not throw when only title is provided", () => {
    expect(() => assertIssueUpdateInput({ ...base, title: "New title" })).not.toThrow()
  })

  it("does not throw when only body is provided", () => {
    expect(() => assertIssueUpdateInput({ ...base, body: "New body" })).not.toThrow()
  })
})

// --- assertIssueMilestoneSetInput ---

describe("assertIssueMilestoneSetInput", () => {
  const base = { owner: "acme", name: "repo", issueNumber: 1 }

  it("throws when milestoneNumber is zero", () => {
    expect(() => assertIssueMilestoneSetInput({ ...base, milestoneNumber: 0 })).toThrow(
      "Milestone number must be a positive integer",
    )
  })

  it("throws when milestoneNumber is negative", () => {
    expect(() => assertIssueMilestoneSetInput({ ...base, milestoneNumber: -1 })).toThrow(
      "Milestone number must be a positive integer",
    )
  })

  it("throws when milestoneNumber is a float", () => {
    expect(() => assertIssueMilestoneSetInput({ ...base, milestoneNumber: 1.5 })).toThrow(
      "Milestone number must be a positive integer",
    )
  })
})

// --- assertReviewThreadInput ---

describe("assertReviewThreadInput", () => {
  it("throws when threadId is an empty string", () => {
    expect(() => assertReviewThreadInput({ threadId: "" })).toThrow("Review thread id is required")
  })

  it("throws when threadId is whitespace only", () => {
    expect(() => assertReviewThreadInput({ threadId: "   " })).toThrow(
      "Review thread id is required",
    )
  })

  it("throws when threadId is not a string", () => {
    expect(() => assertReviewThreadInput({ threadId: 42 as unknown as string })).toThrow(
      "Review thread id is required",
    )
  })

  it("does not throw for a valid threadId", () => {
    expect(() => assertReviewThreadInput({ threadId: "thread-1" })).not.toThrow()
  })
})

// --- assertReplyToReviewThreadInput ---

describe("assertReplyToReviewThreadInput", () => {
  it("throws when body is empty", () => {
    expect(() => assertReplyToReviewThreadInput({ threadId: "thread-1", body: "" })).toThrow(
      "Reply body is required",
    )
  })

  it("throws when body is whitespace only", () => {
    expect(() => assertReplyToReviewThreadInput({ threadId: "thread-1", body: "   " })).toThrow(
      "Reply body is required",
    )
  })

  it("throws when threadId is also empty (threadId check runs first)", () => {
    expect(() => assertReplyToReviewThreadInput({ threadId: "", body: "ok" })).toThrow(
      "Review thread id is required",
    )
  })

  it("does not throw for valid inputs", () => {
    expect(() =>
      assertReplyToReviewThreadInput({ threadId: "thread-1", body: "LGTM" }),
    ).not.toThrow()
  })
})

// --- assertReleaseViewInput ---

describe("assertReleaseViewInput", () => {
  const base = { owner: "acme", name: "repo" }

  it("throws when tagName is empty", () => {
    expect(() => assertReleaseViewInput({ ...base, tagName: "" })).toThrow(
      "Release tag name is required",
    )
  })

  it("throws when tagName is whitespace only", () => {
    expect(() => assertReleaseViewInput({ ...base, tagName: "  " })).toThrow(
      "Release tag name is required",
    )
  })

  it("throws when owner is empty", () => {
    expect(() => assertReleaseViewInput({ owner: "", name: "repo", tagName: "v1.0.0" })).toThrow(
      "Repository owner and name are required",
    )
  })
})

// --- assertProjectInput ---

describe("assertProjectInput", () => {
  const base = { owner: "acme", projectNumber: 1 }

  it("throws when first is 0", () => {
    expect(() => assertProjectInput({ ...base, first: 0 })).toThrow(
      "`first` must be an integer between 1 and 100",
    )
  })

  it("throws when first is greater than 100", () => {
    expect(() => assertProjectInput({ ...base, first: 101 })).toThrow(
      "`first` must be an integer between 1 and 100",
    )
  })

  it("throws when first is a non-integer", () => {
    expect(() => assertProjectInput({ ...base, first: 1.5 })).toThrow(
      "`first` must be an integer between 1 and 100",
    )
  })

  it("throws when first is NaN", () => {
    expect(() => assertProjectInput({ ...base, first: Number.NaN })).toThrow(
      "`first` must be an integer between 1 and 100",
    )
  })

  it("does not throw when first is exactly 1", () => {
    expect(() => assertProjectInput({ ...base, first: 1 })).not.toThrow()
  })

  it("does not throw when first is exactly 100", () => {
    expect(() => assertProjectInput({ ...base, first: 100 })).not.toThrow()
  })

  it("does not throw when first is undefined", () => {
    expect(() => assertProjectInput(base)).not.toThrow()
  })

  it("throws when projectNumber is 0", () => {
    expect(() => assertProjectInput({ owner: "acme", projectNumber: 0 })).toThrow(
      "Project number must be a positive integer",
    )
  })

  it("throws when owner is empty", () => {
    expect(() => assertProjectInput({ owner: "", projectNumber: 1 })).toThrow(
      "Project owner is required",
    )
  })
})

// --- assertPrCommentsListInput ---

describe("assertPrCommentsListInput", () => {
  const base = { owner: "acme", name: "repo", prNumber: 1, first: 10 }

  it("throws when unresolvedOnly is a non-boolean", () => {
    expect(() =>
      assertPrCommentsListInput({
        ...base,
        unresolvedOnly: "yes" as unknown as boolean,
      }),
    ).toThrow("unresolvedOnly must be a boolean")
  })

  it("throws when includeOutdated is a non-boolean", () => {
    expect(() =>
      assertPrCommentsListInput({
        ...base,
        includeOutdated: 1 as unknown as boolean,
      }),
    ).toThrow("includeOutdated must be a boolean")
  })

  it("does not throw when unresolvedOnly is a boolean", () => {
    expect(() => assertPrCommentsListInput({ ...base, unresolvedOnly: false })).not.toThrow()
  })

  it("does not throw when includeOutdated is a boolean", () => {
    expect(() => assertPrCommentsListInput({ ...base, includeOutdated: true })).not.toThrow()
  })

  it("throws when after cursor is a number", () => {
    expect(() => assertPrCommentsListInput({ ...base, after: 123 as unknown as string })).toThrow(
      "After cursor must be a string",
    )
  })

  it("does not throw when after cursor is null", () => {
    expect(() =>
      assertPrCommentsListInput({ ...base, after: null as unknown as string }),
    ).not.toThrow()
  })
})

// --- assertPrUpdateInput ---

describe("assertPrUpdateInput", () => {
  const base = { owner: "org", name: "repo", prNumber: 1 }

  it("throws when no fields are provided", () => {
    expect(() => assertPrUpdateInput(base)).toThrow(
      "At least one of title, body, or draft must be provided",
    )
  })

  it("throws when title is a non-string", () => {
    expect(() => assertPrUpdateInput({ ...base, title: 42 as unknown as string })).toThrow(
      "PR title must be a string",
    )
  })

  it("throws when body is a non-string", () => {
    expect(() => assertPrUpdateInput({ ...base, body: true as unknown as string })).toThrow(
      "PR body must be a string",
    )
  })

  it("throws when draft is a non-boolean", () => {
    expect(() => assertPrUpdateInput({ ...base, draft: "yes" as unknown as boolean })).toThrow(
      "draft must be a boolean",
    )
  })

  it("does not throw with valid title string", () => {
    expect(() => assertPrUpdateInput({ ...base, title: "New title" })).not.toThrow()
  })

  it("does not throw with valid draft boolean", () => {
    expect(() => assertPrUpdateInput({ ...base, draft: false })).not.toThrow()
  })
})

// --- assertPrMergeInput ---

describe("assertPrMergeInput", () => {
  const base = { owner: "org", name: "repo", prNumber: 1 }

  it("does not throw when mergeMethod is omitted", () => {
    expect(() => assertPrMergeInput(base)).not.toThrow()
  })

  it("does not throw when mergeMethod is MERGE", () => {
    expect(() => assertPrMergeInput({ ...base, mergeMethod: "MERGE" })).not.toThrow()
  })

  it("does not throw when mergeMethod is SQUASH", () => {
    expect(() => assertPrMergeInput({ ...base, mergeMethod: "SQUASH" })).not.toThrow()
  })

  it("does not throw when mergeMethod is REBASE", () => {
    expect(() => assertPrMergeInput({ ...base, mergeMethod: "REBASE" })).not.toThrow()
  })

  it("throws when mergeMethod is an unsupported value", () => {
    expect(() => assertPrMergeInput({ ...base, mergeMethod: "fast-forward" })).toThrow(
      'mergeMethod "fast-forward" is invalid. Expected one of: MERGE, SQUASH, REBASE',
    )
  })

  it("throws when mergeMethod is lowercase", () => {
    expect(() => assertPrMergeInput({ ...base, mergeMethod: "merge" })).toThrow(
      'mergeMethod "merge" is invalid',
    )
  })
})

// --- assertPrBranchUpdateInput ---

describe("assertPrBranchUpdateInput", () => {
  const base = { owner: "org", name: "repo", prNumber: 1 }

  it("does not throw when updateMethod is omitted", () => {
    expect(() => assertPrBranchUpdateInput(base)).not.toThrow()
  })

  it("does not throw when updateMethod is MERGE", () => {
    expect(() => assertPrBranchUpdateInput({ ...base, updateMethod: "MERGE" })).not.toThrow()
  })

  it("does not throw when updateMethod is REBASE", () => {
    expect(() => assertPrBranchUpdateInput({ ...base, updateMethod: "REBASE" })).not.toThrow()
  })

  it("throws when updateMethod is SQUASH (not supported for branch update)", () => {
    expect(() => assertPrBranchUpdateInput({ ...base, updateMethod: "SQUASH" })).toThrow(
      'updateMethod "SQUASH" is invalid. Expected one of: MERGE, REBASE',
    )
  })

  it("throws when updateMethod is an unsupported value", () => {
    expect(() => assertPrBranchUpdateInput({ ...base, updateMethod: "cherry-pick" })).toThrow(
      'updateMethod "cherry-pick" is invalid',
    )
  })
})

// --- assertRepoInput ---

describe("assertRepoInput", () => {
  it("does not throw for valid input", () => {
    expect(() => assertRepoInput({ owner: "acme", name: "repo" })).not.toThrow()
  })

  it("throws when owner is empty", () => {
    expect(() => assertRepoInput({ owner: "", name: "repo" })).toThrow(
      "Repository owner and name are required",
    )
  })

  it("throws when name is empty", () => {
    expect(() => assertRepoInput({ owner: "acme", name: "" })).toThrow(
      "Repository owner and name are required",
    )
  })
})

// --- assertIssueInput ---

describe("assertIssueInput", () => {
  it("does not throw for valid input", () => {
    expect(() => assertIssueInput({ owner: "acme", name: "repo", issueNumber: 1 })).not.toThrow()
  })

  it("throws when owner is empty", () => {
    expect(() => assertIssueInput({ owner: "", name: "repo", issueNumber: 1 })).toThrow(
      "Repository owner and name are required",
    )
  })

  it("throws when issueNumber is not a positive integer", () => {
    expect(() => assertIssueInput({ owner: "acme", name: "repo", issueNumber: 0 })).toThrow(
      "Issue number must be a positive integer",
    )
  })
})

// --- assertIssueCreateInput ---

describe("assertIssueCreateInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueCreateInput({ owner: "acme", name: "repo", title: "Bug" }),
    ).not.toThrow()
  })

  it("throws when title is empty", () => {
    expect(() => assertIssueCreateInput({ owner: "acme", name: "repo", title: "" })).toThrow(
      "Issue title is required",
    )
  })
})

// --- assertIssueMutationInput ---

describe("assertIssueMutationInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueMutationInput({ owner: "acme", name: "repo", issueNumber: 1 }),
    ).not.toThrow()
  })

  it("throws when issueNumber is invalid", () => {
    expect(() =>
      assertIssueMutationInput({ owner: "acme", name: "repo", issueNumber: -1 }),
    ).toThrow("Issue number must be a positive integer")
  })
})

// --- assertIssueLabelsUpdateInput / assertIssueLabelsAddInput ---

describe("assertIssueLabelsUpdateInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueLabelsUpdateInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        labels: ["bug"],
      }),
    ).not.toThrow()
  })

  it("throws when labels is empty", () => {
    expect(() =>
      assertIssueLabelsUpdateInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        labels: [],
      }),
    ).toThrow("Labels must not be empty")
  })
})

describe("assertIssueLabelsAddInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueLabelsAddInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        labels: ["bug"],
      }),
    ).not.toThrow()
  })

  it("throws when labels is not an array", () => {
    expect(() =>
      assertIssueLabelsAddInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        labels: "bug" as unknown as string[],
      }),
    ).toThrow("Labels must be an array of non-empty strings")
  })
})

// --- assertIssueAssigneesUpdateInput / Add / Remove ---

describe("assertIssueAssigneesUpdateInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueAssigneesUpdateInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        assignees: ["user1"],
      }),
    ).not.toThrow()
  })

  it("throws when assignees is empty", () => {
    expect(() =>
      assertIssueAssigneesUpdateInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        assignees: [],
      }),
    ).toThrow("Assignees must not be empty")
  })
})

describe("assertIssueAssigneesAddInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueAssigneesAddInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        assignees: ["user1"],
      }),
    ).not.toThrow()
  })

  it("throws when assignees contains non-string", () => {
    expect(() =>
      assertIssueAssigneesAddInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        assignees: [42 as unknown as string],
      }),
    ).toThrow("Assignees must be an array of non-empty strings")
  })
})

describe("assertIssueAssigneesRemoveInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueAssigneesRemoveInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        assignees: ["user1"],
      }),
    ).not.toThrow()
  })

  it("throws when assignees is empty array", () => {
    expect(() =>
      assertIssueAssigneesRemoveInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        assignees: [],
      }),
    ).toThrow("Assignees must not be empty")
  })
})

// --- assertIssueCommentCreateInput ---

describe("assertIssueCommentCreateInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueCommentCreateInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        body: "Hello",
      }),
    ).not.toThrow()
  })

  it("throws when body is empty", () => {
    expect(() =>
      assertIssueCommentCreateInput({
        owner: "acme",
        name: "repo",
        issueNumber: 1,
        body: "",
      }),
    ).toThrow("Issue comment body is required")
  })
})

// --- assertIssueLinkedPrsListInput ---

describe("assertIssueLinkedPrsListInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueLinkedPrsListInput({ owner: "acme", name: "repo", issueNumber: 1 }),
    ).not.toThrow()
  })

  it("throws when issueNumber is zero", () => {
    expect(() =>
      assertIssueLinkedPrsListInput({ owner: "acme", name: "repo", issueNumber: 0 }),
    ).toThrow("Issue number must be a positive integer")
  })
})

// --- assertIssueRelationsGetInput ---

describe("assertIssueRelationsGetInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueRelationsGetInput({ owner: "acme", name: "repo", issueNumber: 5 }),
    ).not.toThrow()
  })

  it("throws when owner is empty", () => {
    expect(() => assertIssueRelationsGetInput({ owner: "", name: "repo", issueNumber: 5 })).toThrow(
      "Repository owner and name are required",
    )
  })
})

// --- assertIssueParentSetInput / assertIssueParentRemoveInput ---

describe("assertIssueParentSetInput", () => {
  it("does not throw for valid input", () => {
    expect(() => assertIssueParentSetInput({ issueId: "I_1", parentIssueId: "I_2" })).not.toThrow()
  })

  it("throws when issueId is empty", () => {
    expect(() => assertIssueParentSetInput({ issueId: "", parentIssueId: "I_2" })).toThrow(
      "Issue id is required",
    )
  })

  it("throws when parentIssueId is empty", () => {
    expect(() => assertIssueParentSetInput({ issueId: "I_1", parentIssueId: "" })).toThrow(
      "Parent issue id is required",
    )
  })
})

describe("assertIssueParentRemoveInput", () => {
  it("does not throw for valid input", () => {
    expect(() => assertIssueParentRemoveInput({ issueId: "I_1" })).not.toThrow()
  })

  it("throws when issueId is empty", () => {
    expect(() => assertIssueParentRemoveInput({ issueId: "" })).toThrow("Issue id is required")
  })
})

// --- assertIssueBlockedByInput ---

describe("assertIssueBlockedByInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertIssueBlockedByInput({ issueId: "I_1", blockedByIssueId: "I_2" }),
    ).not.toThrow()
  })

  it("throws when issueId is empty", () => {
    expect(() => assertIssueBlockedByInput({ issueId: "", blockedByIssueId: "I_2" })).toThrow(
      "Issue id is required",
    )
  })

  it("throws when blockedByIssueId is empty", () => {
    expect(() => assertIssueBlockedByInput({ issueId: "I_1", blockedByIssueId: "" })).toThrow(
      "Blocked-by issue id is required",
    )
  })
})

// --- assertPrInput ---

describe("assertPrInput", () => {
  it("does not throw for valid input", () => {
    expect(() => assertPrInput({ owner: "acme", name: "repo", prNumber: 1 })).not.toThrow()
  })

  it("throws when owner is empty", () => {
    expect(() => assertPrInput({ owner: "", name: "repo", prNumber: 1 })).toThrow(
      "Repository owner and name are required",
    )
  })

  it("throws when prNumber is zero", () => {
    expect(() => assertPrInput({ owner: "acme", name: "repo", prNumber: 0 })).toThrow(
      "PR number must be a positive integer",
    )
  })
})

// --- assertPrListInput ---

describe("assertPrListInput", () => {
  it("does not throw for valid input", () => {
    expect(() => assertPrListInput({ owner: "acme", name: "repo", first: 10 })).not.toThrow()
  })

  it("throws when first is zero", () => {
    expect(() => assertPrListInput({ owner: "acme", name: "repo", first: 0 })).toThrow(
      "List page size must be a positive integer",
    )
  })
})

// --- assertPrReviewsListInput ---

describe("assertPrReviewsListInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertPrReviewsListInput({ owner: "acme", name: "repo", prNumber: 1, first: 10 }),
    ).not.toThrow()
  })

  it("throws when owner is not a string", () => {
    expect(() =>
      assertPrReviewsListInput({
        owner: 42 as unknown as string,
        name: "repo",
        prNumber: 1,
        first: 10,
      }),
    ).toThrow("Repository owner and name are required")
  })

  it("throws when prNumber is invalid", () => {
    expect(() =>
      assertPrReviewsListInput({ owner: "acme", name: "repo", prNumber: -1, first: 10 }),
    ).toThrow("PR number must be a positive integer")
  })

  it("throws when first is invalid", () => {
    expect(() =>
      assertPrReviewsListInput({ owner: "acme", name: "repo", prNumber: 1, first: 0 }),
    ).toThrow("List page size must be a positive integer")
  })
})

// --- assertPrDiffListFilesInput ---

describe("assertPrDiffListFilesInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertPrDiffListFilesInput({ owner: "acme", name: "repo", prNumber: 1, first: 10 }),
    ).not.toThrow()
  })

  it("throws when owner is not a string", () => {
    expect(() =>
      assertPrDiffListFilesInput({
        owner: 42 as unknown as string,
        name: "repo",
        prNumber: 1,
        first: 10,
      }),
    ).toThrow("Repository owner and name are required")
  })

  it("throws when prNumber is invalid", () => {
    expect(() =>
      assertPrDiffListFilesInput({ owner: "acme", name: "repo", prNumber: 0, first: 10 }),
    ).toThrow("PR number must be a positive integer")
  })

  it("throws when first is invalid", () => {
    expect(() =>
      assertPrDiffListFilesInput({ owner: "acme", name: "repo", prNumber: 1, first: 0 }),
    ).toThrow("List page size must be a positive integer")
  })
})

// --- asRecord ---

describe("asRecord", () => {
  it("returns the record for a plain object", () => {
    const obj = { a: 1 }
    expect(asRecord(obj)).toBe(obj)
  })

  it("returns null for an array", () => {
    expect(asRecord([1, 2])).toBeNull()
  })

  it("returns null for null", () => {
    expect(asRecord(null)).toBeNull()
  })

  it("returns null for a string", () => {
    expect(asRecord("hello")).toBeNull()
  })

  it("returns null for a number", () => {
    expect(asRecord(42)).toBeNull()
  })

  it("returns null for undefined", () => {
    expect(asRecord(undefined)).toBeNull()
  })
})

// --- assertRepoAndPaginationInput ---

describe("assertRepoAndPaginationInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertRepoAndPaginationInput({ owner: "acme", name: "repo", first: 10 }),
    ).not.toThrow()
  })

  it("throws when owner is empty", () => {
    expect(() => assertRepoAndPaginationInput({ owner: "", name: "repo", first: 10 })).toThrow(
      "Repository owner and name are required",
    )
  })

  it("throws when first is zero", () => {
    expect(() => assertRepoAndPaginationInput({ owner: "acme", name: "repo", first: 0 })).toThrow(
      "List page size must be a positive integer between 1 and 100",
    )
  })

  it("throws when first exceeds upper bound of 100", () => {
    expect(() => assertRepoAndPaginationInput({ owner: "acme", name: "repo", first: 101 })).toThrow(
      "List page size must be a positive integer between 1 and 100",
    )
  })
})

// --- assertProjectOrgInput ---

describe("assertProjectOrgInput", () => {
  it("does not throw for valid input", () => {
    expect(() => assertProjectOrgInput({ org: "acme", projectNumber: 1 })).not.toThrow()
  })

  it("throws when org is empty", () => {
    expect(() => assertProjectOrgInput({ org: "", projectNumber: 1 })).toThrow(
      "Organization name is required",
    )
  })

  it("throws when projectNumber is zero", () => {
    expect(() => assertProjectOrgInput({ org: "acme", projectNumber: 0 })).toThrow(
      "Project number must be a positive integer",
    )
  })
})

// --- assertProjectUserInput ---

describe("assertProjectUserInput", () => {
  it("does not throw for valid input", () => {
    expect(() => assertProjectUserInput({ user: "octocat", projectNumber: 1 })).not.toThrow()
  })

  it("throws when user is empty", () => {
    expect(() => assertProjectUserInput({ user: "", projectNumber: 1 })).toThrow(
      "User login is required",
    )
  })

  it("throws when projectNumber is zero", () => {
    expect(() => assertProjectUserInput({ user: "octocat", projectNumber: 0 })).toThrow(
      "Project number must be a positive integer",
    )
  })
})

// --- assertPrCreateInput ---

describe("assertPrCreateInput", () => {
  const valid = {
    owner: "acme",
    name: "repo",
    title: "Fix bug",
    headRefName: "feature",
    baseRefName: "main",
  }

  it("does not throw for valid input", () => {
    expect(() => assertPrCreateInput(valid)).not.toThrow()
  })

  it("throws when title is empty", () => {
    expect(() => assertPrCreateInput({ ...valid, title: "" })).toThrow("PR title is required")
  })

  it("throws when headRefName is empty", () => {
    expect(() => assertPrCreateInput({ ...valid, headRefName: "" })).toThrow(
      "Head branch name is required",
    )
  })

  it("throws when draft is a non-boolean", () => {
    expect(() => assertPrCreateInput({ ...valid, draft: "yes" as unknown as boolean })).toThrow(
      "draft must be a boolean",
    )
  })

  it("does not throw when draft is a boolean", () => {
    expect(() => assertPrCreateInput({ ...valid, draft: true })).not.toThrow()
  })

  it("throws when body is a non-string", () => {
    expect(() => assertPrCreateInput({ ...valid, body: 123 as unknown as string })).toThrow(
      "PR body must be a string",
    )
  })
})

// --- assertPrAssigneesInput ---

describe("assertPrAssigneesInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertPrAssigneesInput({
        owner: "acme",
        name: "repo",
        prNumber: 1,
        assignees: ["user1"],
      }),
    ).not.toThrow()
  })

  it("throws when assignees is empty", () => {
    expect(() =>
      assertPrAssigneesInput({ owner: "acme", name: "repo", prNumber: 1, assignees: [] }),
    ).toThrow("Assignees must not be empty")
  })
})

// --- assertPrReviewsRequestInput ---

describe("assertPrReviewsRequestInput", () => {
  it("does not throw for valid input", () => {
    expect(() =>
      assertPrReviewsRequestInput({
        owner: "acme",
        name: "repo",
        prNumber: 1,
        reviewers: ["reviewer1"],
      }),
    ).not.toThrow()
  })

  it("throws when reviewers is empty", () => {
    expect(() =>
      assertPrReviewsRequestInput({
        owner: "acme",
        name: "repo",
        prNumber: 1,
        reviewers: [],
      }),
    ).toThrow("Reviewers must not be empty")
  })
})

// --- assertPrReviewSubmitInput ---

describe("assertPrReviewSubmitInput", () => {
  const valid = { owner: "acme", name: "repo", prNumber: 1, event: "APPROVE" }

  it("does not throw for valid APPROVE event", () => {
    expect(() => assertPrReviewSubmitInput(valid)).not.toThrow()
  })

  it("does not throw for COMMENT event", () => {
    expect(() => assertPrReviewSubmitInput({ ...valid, event: "COMMENT" })).not.toThrow()
  })

  it("does not throw for REQUEST_CHANGES event", () => {
    expect(() => assertPrReviewSubmitInput({ ...valid, event: "REQUEST_CHANGES" })).not.toThrow()
  })

  it("throws for invalid event string", () => {
    expect(() => assertPrReviewSubmitInput({ ...valid, event: "DISMISS" })).toThrow(
      'event "DISMISS" is invalid. Expected one of: APPROVE, COMMENT, REQUEST_CHANGES',
    )
  })

  it("throws when event is missing", () => {
    expect(() =>
      assertPrReviewSubmitInput({
        owner: "acme",
        name: "repo",
        prNumber: 1,
        event: "",
      }),
    ).toThrow("Review event is required")
  })

  it("throws when comments is not an array", () => {
    expect(() =>
      assertPrReviewSubmitInput({
        ...valid,
        comments: "not-array" as unknown as DraftComment[],
      }),
    ).toThrow("comments must be an array")
  })

  it("throws when a draft comment is missing path", () => {
    expect(() =>
      assertPrReviewSubmitInput({
        ...valid,
        comments: [{ body: "fix this", line: 10 } as unknown as DraftComment],
      }),
    ).toThrow("comments[0].path is required")
  })

  it("throws when a draft comment is missing body", () => {
    expect(() =>
      assertPrReviewSubmitInput({
        ...valid,
        comments: [{ path: "src/index.ts", line: 10 } as unknown as DraftComment],
      }),
    ).toThrow("comments[0].body is required")
  })

  it("throws when a draft comment has invalid line", () => {
    expect(() =>
      assertPrReviewSubmitInput({
        ...valid,
        comments: [{ path: "src/index.ts", body: "fix", line: 0 }],
      }),
    ).toThrow("comments[0].line must be a positive integer")
  })

  it("does not throw with valid comments", () => {
    expect(() =>
      assertPrReviewSubmitInput({
        ...valid,
        comments: [{ path: "src/index.ts", body: "fix this", line: 10 }],
      }),
    ).not.toThrow()
  })

  it("throws when a comment entry is null", () => {
    expect(() =>
      assertPrReviewSubmitInput({
        ...valid,
        comments: [null as unknown as DraftComment],
      }),
    ).toThrow("comments[0] must be an object")
  })
})
