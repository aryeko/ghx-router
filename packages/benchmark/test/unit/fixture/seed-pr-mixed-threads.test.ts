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

import {
  createPrWithMixedThreads,
  resetMixedPrThreads,
} from "@bench/fixture/seed-pr-mixed-threads.js"

describe("createPrWithMixedThreads", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("creates pr with mixed threads successfully", () => {
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
      // resolveThreadId × 4
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }] } } } },
      })
      .mockReturnValueOnce({
        data: {
          repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }] } } },
        },
      })
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }, { id: "T2" }] } },
          },
        },
      })
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }, { id: "T2" }, { id: "T3" }] },
            },
          },
        },
      })

    // 7 comment adds + 4 resolves
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    tryRunGhMock.mockReturnValue("") // label add

    const result = createPrWithMixedThreads(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result).toEqual({
      id: "PR_NODE_5",
      number: 5,
      resolved_count: 4,
      unresolved_count: 3,
    })
    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(11) // 7 comments + 4 resolves
  })

  it("handles case when fewer than 4 threads exist", () => {
    // 7 comments added, but nodes only ever contain 2 threads → resolveCount = min(4, 7) = 4
    // but resolveThreadId returns null for indices 2 and 3 → only 2 actual resolves
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list
      .mockReturnValueOnce({ headRefOid: "def456" }) // getPrHeadSha
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { totalCount: 0 } } } },
      }) // countPrThreads
      // resolveThreadId × 4 (indices 2 and 3 return null because nodes.length = 2)
      .mockReturnValueOnce({
        data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }] } } } },
      })
      .mockReturnValueOnce({
        data: {
          repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }] } } },
        },
      })
      .mockReturnValueOnce({
        data: {
          repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }] } } },
        },
      })
      .mockReturnValueOnce({
        data: {
          repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T0" }, { id: "T1" }] } } },
        },
      })

    tryRunGhWithTokenMock
      // 7 comment adds
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      // 2 resolves (only 2 threads have valid IDs at their indices)
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    tryRunGhMock.mockReturnValue("") // label add

    const result = createPrWithMixedThreads(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result.resolved_count).toBe(4)
    expect(result.unresolved_count).toBe(3)
  })
})

describe("resetMixedPrThreads", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("unresolves all threads and resolves first 4", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [
                { id: "t1" },
                { id: "t2" },
                { id: "t3" },
                { id: "t4" },
                { id: "t5" },
                { id: "t6" },
                { id: "t7" },
              ],
            },
          },
        },
      },
    })

    // 7 unresolves + 4 resolves
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    resetMixedPrThreads("aryeko/ghx-bench-fixtures", 42, "reviewer-token")

    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(11)
  })

  it("handles case with fewer than 4 threads", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [{ id: "t1" }, { id: "t2" }],
            },
          },
        },
      },
    })

    // 2 unresolves + 2 resolves
    tryRunGhWithTokenMock
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})
      .mockReturnValueOnce({})

    resetMixedPrThreads("aryeko/ghx-bench-fixtures", 42, "reviewer-token")

    expect(tryRunGhWithTokenMock).toHaveBeenCalledTimes(4)
  })
})
