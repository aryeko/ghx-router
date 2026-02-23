import {
  parseCheckRunIdFromJob,
  parseWorkflowRunCreatedAtMs,
  parseWorkflowRunIdFromLink,
} from "@bench/fixture/workflow-parse-utils.js"
import { describe, expect, it } from "vitest"

describe("parseWorkflowRunIdFromLink", () => {
  it("extracts run id from a full GitHub Actions URL", () => {
    expect(parseWorkflowRunIdFromLink("https://github.com/owner/repo/actions/runs/12345")).toBe(
      12345,
    )
  })

  it("returns null when the URL does not contain /actions/runs/", () => {
    expect(parseWorkflowRunIdFromLink("https://github.com/owner/repo")).toBeNull()
  })

  it("returns null for an empty string", () => {
    expect(parseWorkflowRunIdFromLink("")).toBeNull()
  })

  it("returns null when the run segment is not a positive integer", () => {
    expect(parseWorkflowRunIdFromLink("/actions/runs/0")).toBeNull()
    expect(parseWorkflowRunIdFromLink("/actions/runs/abc")).toBeNull()
  })
})

describe("parseWorkflowRunCreatedAtMs", () => {
  it("parses a valid ISO timestamp string", () => {
    const ts = parseWorkflowRunCreatedAtMs({ createdAt: "2024-01-15T12:00:00Z" })
    expect(ts).toBeGreaterThan(0)
    expect(Number.isFinite(ts)).toBe(true)
  })

  it("returns 0 for a non-string createdAt", () => {
    expect(parseWorkflowRunCreatedAtMs({ createdAt: 12345 })).toBe(0)
  })

  it("returns 0 for an invalid date string", () => {
    expect(parseWorkflowRunCreatedAtMs({ createdAt: "not-a-date" })).toBe(0)
  })

  it("returns 0 when createdAt is missing", () => {
    expect(parseWorkflowRunCreatedAtMs({})).toBe(0)
  })
})

describe("parseCheckRunIdFromJob", () => {
  it("returns checkRunId when present as a positive integer", () => {
    expect(parseCheckRunIdFromJob({ checkRunId: 42 })).toBe(42)
  })

  it("returns check_run_id (snake_case) when present", () => {
    expect(parseCheckRunIdFromJob({ check_run_id: 99 })).toBe(99)
  })

  it("extracts id from checkRunUrl", () => {
    expect(
      parseCheckRunIdFromJob({
        checkRunUrl: "https://api.github.com/repos/owner/repo/check-runs/777",
      }),
    ).toBe(777)
  })

  it("extracts id from check_run_url (snake_case)", () => {
    expect(
      parseCheckRunIdFromJob({
        check_run_url: "https://api.github.com/repos/owner/repo/check-runs/888",
      }),
    ).toBe(888)
  })

  it("returns null when neither id field nor url is present", () => {
    expect(parseCheckRunIdFromJob({})).toBeNull()
  })

  it("returns null when checkRunId is zero", () => {
    expect(parseCheckRunIdFromJob({ checkRunId: 0 })).toBeNull()
  })

  it("returns null when checkRunId is negative", () => {
    expect(parseCheckRunIdFromJob({ checkRunId: -5 })).toBeNull()
  })

  it("returns null when URL does not contain /check-runs/", () => {
    expect(
      parseCheckRunIdFromJob({ checkRunUrl: "https://api.github.com/repos/owner/repo" }),
    ).toBeNull()
  })
})
