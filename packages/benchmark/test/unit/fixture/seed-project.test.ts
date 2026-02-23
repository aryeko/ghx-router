import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhJsonMock = vi.hoisted(() => vi.fn())
const tryRunGhJsonMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGhJson: runGhJsonMock,
  tryRunGhJson: tryRunGhJsonMock,
}))

import { ensureProjectFixture } from "@bench/fixture/seed-project.js"

describe("ensureProjectFixture", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("uses existing project when found", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([
      {
        id: "F1",
        type: "ProjectV2SingleSelectField",
        options: [{ id: "OPT1" }],
      },
    ])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result).toEqual({
      number: 1,
      id: "PROJ_1",
      item_id: "ITEM_1",
      field_id: "F1",
      option_id: "OPT1",
    })
  })

  it("creates project when not found", () => {
    runGhJsonMock
      .mockReturnValueOnce({ projects: [] })
      .mockReturnValueOnce({ number: 1, id: "PROJ_1" })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([
      {
        id: "F1",
        type: "ProjectV2SingleSelectField",
        options: [{ id: "OPT1" }],
      },
    ])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result).toEqual({
      number: 1,
      id: "PROJ_1",
      item_id: "ITEM_1",
      field_id: "F1",
      option_id: "OPT1",
    })
    expect(runGhJsonMock).toHaveBeenCalledWith(expect.arrayContaining(["project", "create"]))
  })

  it("handles case-insensitive project title match", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [
        { number: 1, id: "PROJ_1", title: "ghx bench fixtures" }, // lowercase
      ],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.id).toBe("PROJ_1")
  })

  it("sets item_id when item-add succeeds", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_123" }).mockReturnValueOnce([])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.item_id).toBe("ITEM_123")
  })

  it("sets empty item_id when item-add returns null", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock
      .mockReturnValueOnce(null) // item-add failed
      .mockReturnValueOnce([])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.item_id).toBe("")
  })

  it("finds ProjectV2SingleSelectField with options", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([
      { id: "F0", type: "ProjectV2TextField", options: [] },
      {
        id: "F1",
        type: "ProjectV2SingleSelectField",
        options: [{ id: "OPT1" }, { id: "OPT2" }],
      },
    ])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.field_id).toBe("F1")
    expect(result.option_id).toBe("OPT1")
  })

  it("returns empty field_id and option_id when no eligible field found", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([
      { id: "F0", type: "ProjectV2TextField", options: [] },
      { id: "F1", type: "ProjectV2SingleSelectField", options: [] }, // no options
    ])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.field_id).toBe("")
    expect(result.option_id).toBe("")
  })

  it("skips non-object fields", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([
      "string",
      null,
      {
        id: "F1",
        type: "ProjectV2SingleSelectField",
        options: [{ id: "OPT1" }],
      },
    ])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.field_id).toBe("F1")
  })

  it("skips items without id or type", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([
      { type: "ProjectV2SingleSelectField", options: [{ id: "OPT1" }] }, // missing id
      { id: "F1", options: [{ id: "OPT1" }] }, // missing type
      { id: "F2", type: "ProjectV2SingleSelectField", options: [{ id: "OPT2" }] },
    ])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.field_id).toBe("F2")
  })

  it("parses option id from first option", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([
      {
        id: "F1",
        type: "ProjectV2SingleSelectField",
        options: [{ id: "FIRST_OPT" }, { id: "SECOND_OPT" }],
      },
    ])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.option_id).toBe("FIRST_OPT")
  })

  it("returns empty option_id when first option has no id", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([
      {
        id: "F1",
        type: "ProjectV2SingleSelectField",
        options: [{ name: "OPT1" }, { id: "OPT2" }], // first option missing id
      },
    ])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.field_id).toBe("")
    expect(result.option_id).toBe("")
  })

  it("skips projects without number or id", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [
        { id: "PROJ_1", title: "GHX Bench Fixtures" }, // missing number
        { number: 1, title: "GHX Bench Fixtures" }, // missing id
        { number: 2, id: "PROJ_2", title: "GHX Bench Fixtures" },
      ],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce([])

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.number).toBe(2)
    expect(result.id).toBe("PROJ_2")
  })

  it("parses response with nodes property for fields", () => {
    runGhJsonMock.mockReturnValueOnce({
      projects: [{ number: 1, id: "PROJ_1", title: "GHX Bench Fixtures" }],
    })

    tryRunGhJsonMock.mockReturnValueOnce({ id: "ITEM_1" }).mockReturnValueOnce({
      fields: [
        {
          id: "F1",
          type: "ProjectV2SingleSelectField",
          options: [{ id: "OPT1" }],
        },
      ],
    })

    const result = ensureProjectFixture(
      "aryeko",
      "https://github.com/aryeko/ghx-bench-fixtures/issues/1",
    )

    expect(result.field_id).toBe("F1")
  })
})
