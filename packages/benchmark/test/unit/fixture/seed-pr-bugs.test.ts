import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhMock = vi.hoisted(() => vi.fn())
const tryRunGhMock = vi.hoisted(() => vi.fn())
const runGhJsonMock = vi.hoisted(() => vi.fn())
const tryRunGhJsonMock = vi.hoisted(() => vi.fn())
const runGhJsonWithTokenMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGh: runGhMock,
  tryRunGh: tryRunGhMock,
  runGhJson: runGhJsonMock,
  tryRunGhJson: tryRunGhJsonMock,
  runGhJsonWithToken: runGhJsonWithTokenMock,
}))

const getPrHeadShaMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/seed-pr-basic.js", () => ({
  getPrHeadSha: getPrHeadShaMock,
}))

import { createPrWithBugs, resetPrBugs } from "@bench/fixture/seed-pr-bugs.js"

describe("createPrWithBugs", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("creates PR with bugs successfully using reviewer token", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check (no existing file)
      .mockReturnValueOnce([]) // PR list (no existing)

    runGhJsonWithTokenMock.mockReturnValueOnce({
      number: 7,
      node_id: "PR_NODE_7",
    })

    tryRunGhMock.mockReturnValue("") // label add

    getPrHeadShaMock.mockReturnValue("headsha123")

    const result = createPrWithBugs(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result).toEqual({ id: "PR_NODE_7", number: 7 })
    expect(runGhJsonWithTokenMock).toHaveBeenCalledWith(
      expect.arrayContaining(["api", "repos/aryeko/ghx-bench-fixtures/pulls"]),
      "reviewer-token",
    )
    expect(tryRunGhMock).toHaveBeenCalledWith(expect.arrayContaining(["labels[]=bench-fixture"]))
  })

  it("reuses existing PR without creating a new one", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([{ id: "PR_EXISTING", number: 42 }]) // PR list - found!

    getPrHeadShaMock.mockReturnValue("headsha456")

    const result = createPrWithBugs(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      "bench-seed:test-1",
      "reviewer-token",
    )

    expect(result).toEqual({ id: "PR_EXISTING", number: 42 })
    expect(runGhJsonWithTokenMock).not.toHaveBeenCalled()
    expect(tryRunGhMock).not.toHaveBeenCalled()
  })

  it("includes existing file sha in content PUT when file already exists", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce({ sha: "existing-blob-sha" }) // file check - file exists
      .mockReturnValueOnce([]) // PR list

    runGhJsonWithTokenMock.mockReturnValueOnce({ number: 8, node_id: "PR_NODE_8" })
    tryRunGhMock.mockReturnValue("")
    getPrHeadShaMock.mockReturnValue("headsha789")

    createPrWithBugs("aryeko/ghx-bench-fixtures", "seed-123", "bench-seed:test-1", "reviewer-token")

    const contentPutCall = runGhJsonMock.mock.calls[1]
    expect(contentPutCall?.[0]).toEqual(expect.arrayContaining(["-f", "sha=existing-blob-sha"]))
  })

  it("throws when unable to resolve base sha", () => {
    runGhJsonMock.mockReturnValueOnce({ object: { sha: "" } }) // empty sha

    expect(() => {
      createPrWithBugs(
        "aryeko/ghx-bench-fixtures",
        "seed-123",
        "bench-seed:test-1",
        "reviewer-token",
      )
    }).toThrow("unable to resolve base sha for bugs PR creation")
  })

  it("throws when PR creation returns invalid data", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list

    runGhJsonWithTokenMock.mockReturnValueOnce({ number: 0, node_id: "" }) // invalid result
    tryRunGhMock.mockReturnValue("")

    expect(() => {
      createPrWithBugs(
        "aryeko/ghx-bench-fixtures",
        "seed-123",
        "bench-seed:test-1",
        "reviewer-token",
      )
    }).toThrow("failed to create bugs fixture PR")
  })

  it("throws when unable to resolve head sha", () => {
    runGhJsonMock
      .mockReturnValueOnce({ object: { sha: "abc123" } }) // git ref
      .mockReturnValueOnce({}) // content PUT

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // branch create
      .mockReturnValueOnce(null) // file check
      .mockReturnValueOnce([]) // PR list

    runGhJsonWithTokenMock.mockReturnValueOnce({ number: 9, node_id: "PR_NODE_9" })
    tryRunGhMock.mockReturnValue("")
    getPrHeadShaMock.mockReturnValue(null) // head sha not resolvable

    expect(() => {
      createPrWithBugs(
        "aryeko/ghx-bench-fixtures",
        "seed-123",
        "bench-seed:test-1",
        "reviewer-token",
      )
    }).toThrow("unable to resolve head sha for bugs PR")
  })
})

describe("resetPrBugs", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("deletes all review comments on the PR", () => {
    tryRunGhJsonMock.mockReturnValue([{ id: 101 }, { id: 102 }, { id: 103 }])

    resetPrBugs("aryeko/ghx-bench-fixtures", 7, "reviewer-token")

    expect(tryRunGhMock).toHaveBeenCalledTimes(3)
    expect(tryRunGhMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        "repos/aryeko/ghx-bench-fixtures/pulls/comments/101",
        "--method",
        "DELETE",
      ]),
    )
    expect(tryRunGhMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        "repos/aryeko/ghx-bench-fixtures/pulls/comments/102",
        "--method",
        "DELETE",
      ]),
    )
  })

  it("handles empty comments list", () => {
    tryRunGhJsonMock.mockReturnValue([])

    resetPrBugs("aryeko/ghx-bench-fixtures", 7, "reviewer-token")

    expect(tryRunGhMock).not.toHaveBeenCalled()
  })

  it("skips comments with non-numeric id", () => {
    tryRunGhJsonMock.mockReturnValue([{ id: "string-id" }, { id: 200 }, { other: "field" }])

    resetPrBugs("aryeko/ghx-bench-fixtures", 7, "reviewer-token")

    expect(tryRunGhMock).toHaveBeenCalledTimes(1)
    expect(tryRunGhMock).toHaveBeenCalledWith(
      expect.arrayContaining(["repos/aryeko/ghx-bench-fixtures/pulls/comments/200"]),
    )
  })

  it("handles null result from comments API", () => {
    tryRunGhJsonMock.mockReturnValue(null)

    expect(() => {
      resetPrBugs("aryeko/ghx-bench-fixtures", 7, "reviewer-token")
    }).not.toThrow()

    expect(tryRunGhMock).not.toHaveBeenCalled()
  })
})
