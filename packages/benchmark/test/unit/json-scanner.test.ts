import { describe, expect, it } from "vitest"
import { extractFirstJsonArray, extractFirstJsonValue } from "../../src/extract/envelope.js"

describe("extractFirstJsonArray", () => {
  it("extracts a JSON array from mixed text", () => {
    expect(extractFirstJsonArray("result: [1, 2, 3] more")).toEqual([1, 2, 3])
  })

  it("handles nested arrays", () => {
    expect(extractFirstJsonArray("[[1, 2], [3, 4]]")).toEqual([
      [1, 2],
      [3, 4],
    ])
  })

  it("returns null when no array present", () => {
    expect(extractFirstJsonArray("no arrays here")).toBeNull()
  })

  it("handles strings with brackets inside", () => {
    expect(extractFirstJsonArray('["hello [world]"]')).toEqual(["hello [world]"])
  })
})

describe("extractFirstJsonValue", () => {
  it("picks object when { appears before [", () => {
    expect(extractFirstJsonValue('{"a":1} [2]')).toEqual({ a: 1 })
  })

  it("picks array when [ appears before {", () => {
    expect(extractFirstJsonValue('[1] {"a":2}')).toEqual([1])
  })

  it("returns null for no JSON", () => {
    expect(extractFirstJsonValue("plain text")).toBeNull()
  })
})
