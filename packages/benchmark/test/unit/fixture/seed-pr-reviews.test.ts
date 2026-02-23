import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhMock = vi.hoisted(() => vi.fn())
const tryRunGhMock = vi.hoisted(() => vi.fn())
const runGhJsonMock = vi.hoisted(() => vi.fn())
const tryRunGhJsonMock = vi.hoisted(() => vi.fn())
const tryRunGhWithTokenMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGh: runGhMock,
  tryRunGh: tryRunGhMock,
  runGhJson: runGhJsonMock,
  tryRunGhJson: tryRunGhJsonMock,
  tryRunGhWithToken: tryRunGhWithTokenMock,
}))

import { createPrWithReviews, resetPrReviewThreads } from "@bench/fixture/seed-pr-reviews.js"

describe("createPrWithReviews", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("creates pr with reviews successfully", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list (no existing)
      .mockReturnValueOnce({ headRefOid: "def456" }) // getPrHeadSha
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { totalCount: 0 } } } },
      }) // countPrThreads
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "THREAD_1" }] } } } },
      }) // findPrThreadId

    // Add 4 review comments + resolve first thread
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    tryRunGhMock.mockReturnValue("") // label add

    const result = createPrWithReviews(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result).toEqual({ id: "PR_NODE_5", number: 5, thread_count: 4 })
    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(5) // 4 comments + 1 resolve
  })

  it("throws when unable to resolve head sha for review comments", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list
      .mockReturnValueOnce(null) // getPrHeadSha → null → throws

    tryRunGhMock.mockReturnValue("") // label add

    expect(() => {
      createPrWithReviews(
        "aryeko/ghx-bench-fixtures",
        "seed-123",
        "bench-seed:test-1",
        "reviewer-token",
      )
    }).toThrow("unable to resolve head sha for review comments")
  })

  it("reuses existing PR", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([{ id: "PR_EXISTING", number: 99 }]) // PR list - found!
      .mockReturnValueOnce({ headRefOid: "def456" }) // getPrHeadSha
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { totalCount: 0 } } } },
      }) // countPrThreads
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "THREAD_1" }] } } } },
      }) // findPrThreadId

    tryRunGhWithTokenMock
      .mockReturnValueOnce({}) // comment 1
      .mockReturnValueOnce({}) // comment 2
      .mockReturnValueOnce({}) // comment 3
      .mockReturnValueOnce({}) // comment 4
      .mockReturnValueOnce({}) // resolve first thread

    tryRunGhMock.mockReturnValue("")

    const result = createPrWithReviews(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result.number).toBe(99)
    expect(runGhJsonMock).toHaveBeenCalledTimes(2) // doesn't create new PR
  })
})

describe("resetPrReviewThreads", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("unresolves all threads and resolves first one", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
            },
          },
        },
      },
    })

    // 3 unresolves + 1 resolve first thread
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    resetPrReviewThreads("aryeko/ghx-bench-fixtures", 42, "reviewer-token")

    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(4)
    expect(tryRunGhWithTokenMock).toHaveBeenCalledWith(
      expect.arrayContaining(["api", "graphql"]),
      "reviewer-token",
    )
  })

  it("handles case with no threads", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [],
            },
          },
        },
      },
    })

    resetPrReviewThreads("aryeko/ghx-bench-fixtures", 42, "reviewer-token")

    expect(tryRunGhWithTokenMock).not.toHaveBeenCalled()
  })
})
