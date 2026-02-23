import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhJsonMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGhJson: runGhJsonMock,
}))

import { findLatestDraftRelease } from "@bench/fixture/seed-release.js"

describe("findLatestDraftRelease", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns null when no draft release found", () => {
    runGhJsonMock.mockReturnValue([
      { id: 1, tag_name: "v1.0.0", draft: false },
      { id: 2, tag_name: "v1.1.0", draft: false },
    ])

    const result = findLatestDraftRelease("aryeko/ghx-bench-fixtures")

    expect(result).toBeNull()
  })

  it("returns draft release when found", () => {
    runGhJsonMock.mockReturnValue([
      { id: 1, tag_name: "v1.0.0", draft: false },
      { id: 2, tag_name: "v1.1.0-bench", draft: true },
    ])

    const result = findLatestDraftRelease("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({ id: 2, tag_name: "v1.1.0-bench" })
  })

  it("returns first draft release when multiple exist", () => {
    runGhJsonMock.mockReturnValue([
      { id: 2, tag_name: "v1.1.0-bench", draft: true },
      { id: 3, tag_name: "v1.2.0-bench", draft: true },
    ])

    const result = findLatestDraftRelease("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({ id: 2, tag_name: "v1.1.0-bench" })
  })

  it("returns null when list is empty", () => {
    runGhJsonMock.mockReturnValue([])

    const result = findLatestDraftRelease("aryeko/ghx-bench-fixtures")

    expect(result).toBeNull()
  })

  it("skips non-object items in list", () => {
    runGhJsonMock.mockReturnValue([
      "string",
      null,
      { id: 2, tag_name: "v1.1.0-bench", draft: true },
    ])

    const result = findLatestDraftRelease("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({ id: 2, tag_name: "v1.1.0-bench" })
  })

  it("skips items with missing id or tag_name", () => {
    runGhJsonMock.mockReturnValue([
      { id: 1, draft: true }, // missing tag_name
      { tag_name: "v2.0.0", draft: true }, // missing id
      { id: 2, tag_name: "v1.1.0-bench", draft: true },
    ])

    const result = findLatestDraftRelease("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({ id: 2, tag_name: "v1.1.0-bench" })
  })

  it("skips items with wrong type for id or tag_name", () => {
    runGhJsonMock.mockReturnValue([
      { id: "not-a-number", tag_name: "v1.0.0", draft: true },
      { id: 1, tag_name: 123, draft: true },
      { id: 2, tag_name: "v1.1.0-bench", draft: true },
    ])

    const result = findLatestDraftRelease("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({ id: 2, tag_name: "v1.1.0-bench" })
  })

  it("skips items where draft is not true", () => {
    runGhJsonMock.mockReturnValue([
      { id: 1, tag_name: "v1.0.0", draft: false },
      { id: 2, tag_name: "v1.1.0-bench", draft: "true" },
      { id: 3, tag_name: "v1.2.0-bench", draft: true },
    ])

    const result = findLatestDraftRelease("aryeko/ghx-bench-fixtures")

    expect(result).toEqual({ id: 3, tag_name: "v1.2.0-bench" })
  })
})
