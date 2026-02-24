import * as path from "node:path"
import {
  buildBenchRunTs,
  buildIterDir,
  sanitizeBenchRunTs,
} from "@bench/runner/iter-log-context.js"
import { describe, expect, it } from "vitest"

describe("sanitizeBenchRunTs", () => {
  it("replaces colons and dots with dashes", () => {
    expect(sanitizeBenchRunTs("2026-02-23T14:30:00.000Z")).toBe("2026-02-23T14-30-00-000Z")
  })

  it("leaves already-sanitized strings unchanged", () => {
    expect(sanitizeBenchRunTs("2026-02-23T14-30-00-000Z")).toBe("2026-02-23T14-30-00-000Z")
  })
})

describe("buildBenchRunTs", () => {
  it("produces a sanitized ISO string with no colons or dots", () => {
    const ts = buildBenchRunTs(new Date("2026-02-23T14:30:00.000Z"))
    expect(ts).toBe("2026-02-23T14-30-00-000Z")
    expect(ts).not.toMatch(/[:.]/)
  })

  it("defaults to current date when no argument provided", () => {
    const ts = buildBenchRunTs()
    // Should be a sanitized ISO string with no colons or dots
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/)
    // Date portion should be a plausible year (2025+)
    const year = Number(ts.slice(0, 4))
    expect(year).toBeGreaterThanOrEqual(2025)
  })
})

describe("buildIterDir", () => {
  it("builds the correct directory path", () => {
    const result = buildIterDir({
      benchLogsDir: "/logs",
      benchRunTs: "2026-02-23T14-30-00-000Z",
      mode: "ghx",
      scenarioId: "pr-fix-001",
      iteration: 2,
    })
    expect(result).toBe(
      path.join("/logs", "2026-02-23", "2026-02-23T14-30-00-000Z", "ghx", "pr-fix-001", "iter-2"),
    )
  })

  it("extracts date from first 10 chars of benchRunTs", () => {
    const result = buildIterDir({
      benchLogsDir: "/bench/logs",
      benchRunTs: "2025-12-01T09-00-00-000Z",
      mode: "agent_direct",
      scenarioId: "issue-wf-001",
      iteration: 1,
    })
    expect(result).toContain(path.join("2025-12-01", "2025-12-01T09-00-00-000Z"))
  })

  it("groups multiple iterations under same benchRunTs", () => {
    const common = {
      benchLogsDir: "/logs",
      benchRunTs: "2026-02-23T14-30-00-000Z",
      mode: "ghx",
      scenarioId: "s1",
    }
    const iter1 = buildIterDir({ ...common, iteration: 1 })
    const iter2 = buildIterDir({ ...common, iteration: 2 })
    const parent = path.join("/logs", "2026-02-23", "2026-02-23T14-30-00-000Z", "ghx", "s1")
    expect(iter1).toBe(path.join(parent, "iter-1"))
    expect(iter2).toBe(path.join(parent, "iter-2"))
  })
})
