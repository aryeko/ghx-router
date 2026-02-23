import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhMock = vi.hoisted(() => vi.fn())
const tryRunGhMock = vi.hoisted(() => vi.fn())
const runGhJsonMock = vi.hoisted(() => vi.fn())
const tryRunGhJsonMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGh: runGhMock,
  tryRunGh: tryRunGhMock,
  runGhJson: runGhJsonMock,
  tryRunGhJson: tryRunGhJsonMock,
}))

import { createSeedPr, ensurePrThread, findSeededPr } from "@bench/fixture/seed-pr-basic.js"

describe("findSeededPr", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns null when tryRunGhJson returns empty list", () => {
    tryRunGhJsonMock.mockReturnValue([])
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toBeNull()
  })

  it("returns pr with id and number when found", () => {
    tryRunGhJsonMock.mockReturnValue([{ id: "PR_1", number: 42 }])
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toEqual({ id: "PR_1", number: 42 })
  })

  it("returns null when list item has wrong types", () => {
    tryRunGhJsonMock.mockReturnValue([{ id: 123, number: "bad" }])
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toBeNull()
  })

  it("returns null when tryRunGhJson returns null", () => {
    tryRunGhJsonMock.mockReturnValue(null)
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toBeNull()
  })

  it("returns null when first item is not an object", () => {
    tryRunGhJsonMock.mockReturnValue(["string"])
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toBeNull()
  })

  it("parses response with items property", () => {
    tryRunGhJsonMock.mockReturnValue({ items: [{ id: "PR_2", number: 5 }] })
    const result = findSeededPr("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    expect(result).toEqual({ id: "PR_2", number: 5 })
  })
})

describe("createSeedPr", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("creates pr successfully with happy path", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list (no existing)

    tryRunGhMock.mockReturnValue("") // label add

    const result = createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")

    expect(result).toEqual({ id: "PR_NODE_5", number: 5 })
    expect(runGhJsonMock).toHaveBeenCalledWith([
      "api",
      "repos/aryeko/ghx-bench-fixtures/git/ref/heads/main",
    ])
    expect(runGhJsonMock).toHaveBeenCalledTimes(3)
  })

  it("throws when base sha is empty", () => {
    runGhJsonMock.mockReturnValueOnce({ object: { sha: "" } })

    expect(() => {
      createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")
    }).toThrow("unable to resolve base sha for fixture PR creation")
  })

  it("throws when base sha is missing", () => {
    runGhJsonMock.mockReturnValueOnce({ object: {} })

    expect(() => {
      createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")
    }).toThrow("unable to resolve base sha for fixture PR creation")
  })

  it("throws when PR creation returns invalid number", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 0, node_id: "PR_NODE_5" }) // PR create

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list

    expect(() => {
      createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")
    }).toThrow("failed to create fixture PR")
  })

  it("throws when node_id is missing", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT
      .mockReturnValueOnce({ number: 5 }) // PR create (no node_id)

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list

    expect(() => {
      createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")
    }).toThrow("failed to create fixture PR")
  })

  it("returns existing PR without creating new one", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([{ id: "PR_EXISTING", number: 99 }]) // PR list - found!

    const result = createSeedPr("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1")

    expect(result).toEqual({ id: "PR_EXISTING", number: 99 })
    expect(runGhJsonMock).toHaveBeenCalledTimes(2) // doesn't create new PR
  })
})

describe("ensurePrThread", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("returns existing thread id when found", () => {
    tryRunGhJsonMock.mockReturnValue({
      data: {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: [{ id: "EXISTING_THREAD" }],
            },
          },
        },
      },
    })

    const result = ensurePrThread("aryeko/ghx-bench-fixtures", 42, "seed-123")

    expect(result).toBe("EXISTING_THREAD")
    expect(tryRunGhMock).not.toHaveBeenCalled() // doesn't create new thread
  })

  it("creates new thread when not found", () => {
    // First call: find thread (none)
    tryRunGhJsonMock
      .mockReturnValueOnce({
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
      // Get head SHA
      .mockReturnValueOnce({ headRefOid: "abc123" })
      // Find thread after create
      .mockReturnValueOnce({
        data: {
          repository: {
            pullRequest: {
              reviewThreads: {
                nodes: [{ id: "NEW_THREAD" }],
              },
            },
          },
        },
      })

    tryRunGhMock.mockReturnValue("")

    const result = ensurePrThread("aryeko/ghx-bench-fixtures", 42, "seed-123")

    expect(result).toBe("NEW_THREAD")
    expect(tryRunGhMock).toHaveBeenCalled()
  })

  it("returns empty string when unable to find or create thread", () => {
    // Find thread (none)
    tryRunGhJsonMock
      .mockReturnValueOnce({
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
      // Get head SHA (fails)
      .mockReturnValueOnce(null)
      // Find thread after create (none)
      .mockReturnValueOnce({
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

    const result = ensurePrThread("aryeko/ghx-bench-fixtures", 42, "seed-123")

    expect(result).toBe("")
  })
})
