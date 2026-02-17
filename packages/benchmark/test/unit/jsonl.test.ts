import { describe, expect, it } from "vitest"
import { z } from "zod"
import { parseJsonlLines } from "../../src/utils/jsonl.js"

const testSchema = z.object({ id: z.string(), value: z.number() })

describe("parseJsonlLines", () => {
  it("parses valid JSONL content", () => {
    const content = '{"id":"a","value":1}\n{"id":"b","value":2}\n'
    const rows = parseJsonlLines(content, testSchema)
    expect(rows).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ])
  })

  it("skips empty lines and whitespace", () => {
    const content = '\n  {"id":"a","value":1}  \n\n'
    expect(parseJsonlLines(content, testSchema)).toHaveLength(1)
  })

  it("throws on invalid JSON", () => {
    expect(() => parseJsonlLines("not json\n", testSchema)).toThrow()
  })

  it("throws on schema-invalid row", () => {
    expect(() => parseJsonlLines('{"id":123}\n', testSchema)).toThrow()
  })

  it("parses without validation when no schema provided", () => {
    const content = '{"anything":"goes"}\n'
    const rows = parseJsonlLines(content)
    expect(rows).toEqual([{ anything: "goes" }])
  })

  it("returns empty array for blank content", () => {
    expect(parseJsonlLines("")).toEqual([])
    expect(parseJsonlLines("  \n  \n")).toEqual([])
  })
})
