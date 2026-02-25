import { describe, expect, it } from "vitest"
import {
  assertIssueCommentsListInput,
  assertIssueListInput,
  assertIssueMilestoneSetInput,
  assertIssueUpdateInput,
  assertNonEmptyString,
  assertOptionalString,
  assertPrCommentsListInput,
  assertProjectInput,
  assertReleaseViewInput,
  assertReplyToReviewThreadInput,
  assertReviewThreadInput,
  assertStringArray,
} from "../../../src/gql/assertions.js"

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
