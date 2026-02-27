import { exportResultsJson, exportSummaryJson } from "@profiler/reporter/json-exporter.js"
import { describe, expect, it } from "vitest"
import { makeProfileRow } from "./_make-profile-row.js"

describe("exportResultsJson", () => {
  it("returns valid JSON", () => {
    const rows = [makeProfileRow()]
    const result = exportResultsJson(rows)
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it("returns an array with correct length", () => {
    const rows = [makeProfileRow(), makeProfileRow()]
    const parsed = JSON.parse(exportResultsJson(rows))
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(2)
  })

  it("preserves row fields", () => {
    const rows = [makeProfileRow({ runId: "run_json", mode: "alpha" })]
    const parsed = JSON.parse(exportResultsJson(rows))
    expect(parsed[0].runId).toBe("run_json")
    expect(parsed[0].mode).toBe("alpha")
  })
})

describe("exportSummaryJson", () => {
  it("returns valid JSON", () => {
    const result = exportSummaryJson([], "run_1")
    expect(() => JSON.parse(result)).not.toThrow()
  })

  it("contains expected top-level fields", () => {
    const rows = [
      makeProfileRow({ mode: "a", scenarioId: "s1", success: true }),
      makeProfileRow({ mode: "b", scenarioId: "s2", success: false }),
    ]
    const parsed = JSON.parse(exportSummaryJson(rows, "run_sum"))
    expect(parsed.version).toBe(1)
    expect(parsed.runId).toBe("run_sum")
    expect(parsed.totalRows).toBe(2)
    expect(parsed.modes).toEqual(["a", "b"])
    expect(parsed.scenarios).toEqual(["s1", "s2"])
    expect(parsed.successRate).toBe(0.5)
  })

  it("contains generatedAt timestamp", () => {
    const parsed = JSON.parse(exportSummaryJson([], "run_1"))
    expect(typeof parsed.generatedAt).toBe("string")
    expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("handles empty rows with zero success rate", () => {
    const parsed = JSON.parse(exportSummaryJson([], "run_empty"))
    expect(parsed.successRate).toBe(0)
    expect(parsed.totalRows).toBe(0)
  })
})
