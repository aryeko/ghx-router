import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhMock = vi.hoisted(() => vi.fn())
const runGhJsonMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGh: runGhMock,
  runGhJson: runGhJsonMock,
}))

import {
  createIssueTriage,
  findOrCreateIssue,
  resetIssueTriage,
} from "@bench/fixture/seed-issue.js"

describe("findOrCreateIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing issue when found", () => {
    runGhJsonMock.mockReturnValueOnce([
      {
        id: "I_1",
        number: 10,
        url: "https://github.com/aryeko/ghx-bench-fixtures/issues/10",
      },
    ])

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_1",
      number: 10,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/10",
    })
    expect(runGhJsonMock).toHaveBeenCalledTimes(1)
  })

  it("creates and returns issue when not found", () => {
    runGhJsonMock
      .mockReturnValueOnce([]) // list returns empty
      .mockReturnValueOnce({ number: 5 }) // create returns number
      .mockReturnValueOnce({
        id: "I_5",
        number: 5,
        url: "https://github.com/aryeko/ghx-bench-fixtures/issues/5",
      }) // view returns full issue

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_5",
      number: 5,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/5",
    })
    expect(runGhJsonMock).toHaveBeenCalledTimes(3)
  })

  it("throws when created issue number is 0", () => {
    runGhJsonMock.mockReturnValueOnce([]).mockReturnValueOnce({ number: 0 })

    expect(() => {
      findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    }).toThrow("failed to create fixture issue")
  })

  it("throws when created issue number is not an integer", () => {
    runGhJsonMock.mockReturnValueOnce([]).mockReturnValueOnce({ number: 3.5 })

    expect(() => {
      findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    }).toThrow("failed to create fixture issue")
  })

  it("throws when created issue number is negative", () => {
    runGhJsonMock.mockReturnValueOnce([]).mockReturnValueOnce({ number: -1 })

    expect(() => {
      findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")
    }).toThrow("failed to create fixture issue")
  })

  it("parses response with items property", () => {
    runGhJsonMock.mockReturnValueOnce({
      items: [
        {
          id: "I_2",
          number: 20,
          url: "https://github.com/aryeko/ghx-bench-fixtures/issues/20",
        },
      ],
    })

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_2",
      number: 20,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/20",
    })
  })

  it("returns null from items when list is empty", () => {
    runGhJsonMock
      .mockReturnValueOnce({ items: [] })
      .mockReturnValueOnce({ number: 7 })
      .mockReturnValueOnce({
        id: "I_7",
        number: 7,
        url: "https://github.com/aryeko/ghx-bench-fixtures/issues/7",
      })

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_7",
      number: 7,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/7",
    })
  })

  it("returns null when existing item has wrong types", () => {
    runGhJsonMock
      .mockReturnValueOnce([{ id: 123, number: "bad", url: "https://..." }])
      .mockReturnValueOnce({ number: 9 })
      .mockReturnValueOnce({
        id: "I_9",
        number: 9,
        url: "https://github.com/aryeko/ghx-bench-fixtures/issues/9",
      })

    const result = findOrCreateIssue("aryeko/ghx-bench-fixtures", "bench-seed:test-1")

    expect(result).toEqual({
      id: "I_9",
      number: 9,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/9",
    })
  })
})

describe("createIssueTriage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns existing issue when found and applies labels", () => {
    runGhJsonMock
      .mockReturnValueOnce([
        {
          id: "I_10",
          number: 10,
          url: "https://github.com/aryeko/ghx-bench-fixtures/issues/10",
        },
      ])
      .mockReturnValueOnce([])

    const result = createIssueTriage("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({
      id: "I_10",
      number: 10,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/10",
    })
    expect(runGhMock).toHaveBeenCalledTimes(2)
    expect(runGhJsonMock).toHaveBeenCalledTimes(2)
  })

  it("creates issue when not found, then applies labels", () => {
    runGhJsonMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce({ number: 20 })
      .mockReturnValueOnce({
        id: "I_20",
        number: 20,
        url: "https://github.com/aryeko/ghx-bench-fixtures/issues/20",
      })
      .mockReturnValueOnce([])

    const result = createIssueTriage("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({
      id: "I_20",
      number: 20,
      url: "https://github.com/aryeko/ghx-bench-fixtures/issues/20",
    })
    expect(runGhJsonMock).toHaveBeenCalledTimes(4)
  })

  it("throws when created issue number is 0", () => {
    runGhJsonMock.mockReturnValueOnce([]).mockReturnValueOnce({ number: 0 })

    expect(() => {
      createIssueTriage("aryeko/ghx-bench-fixtures")
    }).toThrow("failed to create triage fixture issue")
  })

  it("applies triage and feature-request labels via POST", () => {
    runGhJsonMock
      .mockReturnValueOnce([
        {
          id: "I_5",
          number: 5,
          url: "https://github.com/aryeko/ghx-bench-fixtures/issues/5",
        },
      ])
      .mockReturnValueOnce([])

    createIssueTriage("aryeko/ghx-bench-fixtures")

    const postCall = runGhJsonMock.mock.calls.at(1)
    expect(postCall?.[0]).toContain("repos/aryeko/ghx-bench-fixtures/issues/5/labels")
    expect(postCall?.[0]).toContain("--method")
    expect(postCall?.[0]).toContain("POST")
    expect(postCall?.[0]).toContain("labels[]=triage")
    expect(postCall?.[0]).toContain("labels[]=feature-request")
  })
})

describe("resetIssueTriage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("deletes all comments and resets labels", () => {
    runGhJsonMock.mockReturnValueOnce([{ id: 101 }, { id: 202 }]).mockReturnValueOnce([])

    resetIssueTriage("aryeko/ghx-bench-fixtures", 42, "")

    expect(runGhMock).toHaveBeenCalledTimes(2)
    expect(runGhMock.mock.calls.at(0)?.[0]).toContain(
      "repos/aryeko/ghx-bench-fixtures/issues/comments/101",
    )
    expect(runGhMock.mock.calls.at(1)?.[0]).toContain(
      "repos/aryeko/ghx-bench-fixtures/issues/comments/202",
    )

    const putCall = runGhJsonMock.mock.calls.at(1)
    expect(putCall?.[0]).toContain("repos/aryeko/ghx-bench-fixtures/issues/42/labels")
    expect(putCall?.[0]).toContain("--method")
    expect(putCall?.[0]).toContain("PUT")
    expect(putCall?.[0]).toContain("labels[]=bench-fixture")
    expect(putCall?.[0]).toContain("labels[]=triage")
    expect(putCall?.[0]).toContain("labels[]=feature-request")
  })

  it("resets labels even when there are no comments", () => {
    runGhJsonMock.mockReturnValueOnce([]).mockReturnValueOnce([])

    resetIssueTriage("aryeko/ghx-bench-fixtures", 7, "token")

    expect(runGhMock).not.toHaveBeenCalled()
    expect(runGhJsonMock).toHaveBeenCalledTimes(2)
  })

  it("skips non-numeric comment ids", () => {
    runGhJsonMock.mockReturnValueOnce([{ id: "string-id" }, { id: 303 }]).mockReturnValueOnce([])

    resetIssueTriage("aryeko/ghx-bench-fixtures", 10, "")

    expect(runGhMock).toHaveBeenCalledTimes(1)
    expect(runGhMock.mock.calls.at(0)?.[0]).toContain(
      "repos/aryeko/ghx-bench-fixtures/issues/comments/303",
    )
  })

  it("handles non-array comments response gracefully", () => {
    runGhJsonMock.mockReturnValueOnce(null).mockReturnValueOnce([])

    expect(() => {
      resetIssueTriage("aryeko/ghx-bench-fixtures", 5, "")
    }).not.toThrow()

    expect(runGhMock).not.toHaveBeenCalled()
  })
})
