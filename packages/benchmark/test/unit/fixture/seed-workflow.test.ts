import { beforeEach, describe, expect, it, vi } from "vitest"

const runGhJsonMock = vi.hoisted(() => vi.fn())
const tryRunGhJsonMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGhJson: runGhJsonMock,
  tryRunGhJson: tryRunGhJsonMock,
}))

import { findDispatchedFailedRunId, findLatestWorkflowRun } from "@bench/fixture/seed-workflow.js"

describe("findDispatchedFailedRunId", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns run id when tagged run found", () => {
    const runCreatedAtMs = Date.parse("2024-01-01T10:00:00Z")
    tryRunGhJsonMock.mockReturnValue([
      {
        databaseId: 100,
        displayTitle: "Test run for seed-123",
        createdAt: "2024-01-01T10:00:00Z",
      },
      {
        databaseId: 101,
        displayTitle: "Other run",
        createdAt: "2024-01-01T09:00:00Z",
      },
    ])

    const result = findDispatchedFailedRunId(
      "aryeko/ghx-bench-fixtures",
      "seed-123",
      runCreatedAtMs,
    )

    expect(result).toBe(100)
  })

  it("returns run id based on time proximity when no tagged run", () => {
    const dispatchedAtMs = Date.parse("2024-01-01T10:00:00Z")

    tryRunGhJsonMock.mockReturnValue([
      {
        databaseId: 100,
        displayTitle: "Run at +15s",
        createdAt: "2024-01-01T10:00:15Z",
      },
      {
        databaseId: 101,
        displayTitle: "Run at -30s",
        createdAt: "2024-01-01T09:59:30Z",
      },
      {
        databaseId: 102,
        displayTitle: "Old run",
        createdAt: "2024-01-01T09:30:00Z",
      },
    ])

    const result = findDispatchedFailedRunId(
      "aryeko/ghx-bench-fixtures",
      "seed-456",
      dispatchedAtMs,
    )

    expect(result).toBe(100) // closest to dispatch time
  })

  it("returns null when no matching runs found", () => {
    tryRunGhJsonMock.mockReturnValue([])

    const result = findDispatchedFailedRunId("aryeko/ghx-bench-fixtures", "seed-789", Date.now())

    expect(result).toBeNull()
  })

  it("skips non-object items in run list", () => {
    const dispatchedAtMs = Date.parse("2024-01-01T10:00:00Z")

    tryRunGhJsonMock.mockReturnValue([
      "string",
      null,
      {
        databaseId: 100,
        displayTitle: "Run at +15s",
        createdAt: "2024-01-01T10:00:15Z",
      },
    ])

    const result = findDispatchedFailedRunId(
      "aryeko/ghx-bench-fixtures",
      "seed-456",
      dispatchedAtMs,
    )

    expect(result).toBe(100)
  })

  it("filters runs by createdAt timestamp", () => {
    const dispatchedAtMs = Date.parse("2024-01-01T10:00:00Z")

    tryRunGhJsonMock.mockReturnValue([
      {
        databaseId: 100,
        displayTitle: "Way too early",
        createdAt: "2024-01-01T09:50:00Z", // -10 minutes
      },
      {
        databaseId: 101,
        displayTitle: "Just in time",
        createdAt: "2024-01-01T10:00:05Z",
      },
    ])

    const result = findDispatchedFailedRunId(
      "aryeko/ghx-bench-fixtures",
      "seed-456",
      dispatchedAtMs,
    )

    expect(result).toBe(101)
  })

  it("returns null when databaseId is not an integer", () => {
    const dispatchedAtMs = Date.parse("2024-01-01T10:00:00Z")

    tryRunGhJsonMock.mockReturnValue([
      {
        databaseId: "not-a-number",
        displayTitle: "bad run",
        createdAt: "2024-01-01T10:00:15Z",
      },
      {
        databaseId: 100,
        displayTitle: "good run",
        createdAt: "2024-01-01T10:00:20Z",
      },
    ])

    const result = findDispatchedFailedRunId(
      "aryeko/ghx-bench-fixtures",
      "seed-456",
      dispatchedAtMs,
    )

    expect(result).toBe(100)
  })

  it("handles invalid createdAt timestamps", () => {
    const dispatchedAtMs = Date.parse("2024-01-01T10:00:00Z")

    tryRunGhJsonMock.mockReturnValue([
      {
        databaseId: 100,
        displayTitle: "bad timestamp",
        createdAt: "not-a-date",
      },
      {
        databaseId: 101,
        displayTitle: "good timestamp",
        createdAt: "2024-01-01T10:00:15Z",
      },
    ])

    const result = findDispatchedFailedRunId(
      "aryeko/ghx-bench-fixtures",
      "seed-456",
      dispatchedAtMs,
    )

    expect(result).toBe(101)
  })
})

describe("findLatestWorkflowRun", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns workflow run ref with id, job_id, check_run_id from PR checks", () => {
    tryRunGhJsonMock.mockReturnValueOnce([
      { state: "FAILURE", link: "https://github.com/actions/runs/123" },
    ])

    runGhJsonMock.mockReturnValueOnce({
      jobs: [{ databaseId: 456, checkRunId: 789 }],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result).toEqual({
      id: 123,
      job_id: 456,
      check_run_id: 789,
    })
  })

  it("returns null when no checks found", () => {
    tryRunGhJsonMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]) // first run list call fails
      .mockReturnValueOnce([]) // second run list call fails

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result).toBeNull()
  })

  it("prefers failed check over first check", () => {
    tryRunGhJsonMock.mockReturnValueOnce([
      { state: "SUCCESS", link: "https://github.com/actions/runs/100" },
      { state: "FAILURE", link: "https://github.com/actions/runs/200" },
    ])

    runGhJsonMock.mockReturnValueOnce({
      jobs: [{ databaseId: 300, checkRunId: 400 }],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result?.id).toBe(200)
  })

  it("falls back to first check when no failure found", () => {
    tryRunGhJsonMock.mockReturnValueOnce([
      { state: "SUCCESS", link: "https://github.com/actions/runs/100" },
    ])

    runGhJsonMock.mockReturnValueOnce({
      jobs: [{ databaseId: 200, checkRunId: 300 }],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result?.id).toBe(100)
  })

  it("parses run id from link", () => {
    tryRunGhJsonMock.mockReturnValueOnce([
      { state: "FAILURE", link: "https://github.com/aryeko/ghx-bench-fixtures/actions/runs/999" },
    ])

    runGhJsonMock.mockReturnValueOnce({
      jobs: [{ databaseId: 1000, checkRunId: 1001 }],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result?.id).toBe(999)
  })

  it("falls back to run list when no linked run id found", () => {
    tryRunGhJsonMock
      .mockReturnValueOnce([{ state: "SUCCESS", link: "https://github.com/invalid-link" }])
      .mockReturnValueOnce([{ databaseId: 500 }]) // first run list call

    runGhJsonMock.mockReturnValueOnce({
      jobs: [{ databaseId: 600, checkRunId: 700 }],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result?.id).toBe(500)
  })

  it("returns null when no runs found in fallback list", () => {
    tryRunGhJsonMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]) // first run list call fails
      .mockReturnValueOnce([]) // second run list call fails

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result).toBeNull()
  })

  it("handles check without link property", () => {
    tryRunGhJsonMock
      .mockReturnValueOnce([
        { state: "FAILURE" }, // missing link
      ])
      .mockReturnValueOnce([{ databaseId: 500 }]) // first run list call

    runGhJsonMock.mockReturnValueOnce({
      jobs: [{ databaseId: 600, checkRunId: 700 }],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result?.id).toBe(500)
  })

  it("parses check_run_id from url when direct property missing", () => {
    tryRunGhJsonMock.mockReturnValueOnce([
      {
        state: "FAILURE",
        link: "https://github.com/actions/runs/123",
        checkRunUrl: "https://github.com/aryeko/ghx-bench-fixtures/check-runs/999",
      },
    ])

    // When linked run is found, it calls runGhJson to get jobs
    runGhJsonMock.mockReturnValueOnce({
      jobs: [
        {
          databaseId: 456,
          checkRunUrl: "https://github.com/aryeko/ghx-bench-fixtures/check-runs/999",
        },
      ],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    // The check_run_id comes from parseCheckRunIdFromJob on firstJob
    expect(result?.id).toBe(123)
    expect(result?.job_id).toBe(456)
    expect(result?.check_run_id).toBe(999)
  })

  it("handles case with no jobs", () => {
    tryRunGhJsonMock.mockReturnValueOnce([
      { state: "FAILURE", link: "https://github.com/actions/runs/123" },
    ])

    // When linked run is found, it calls runGhJson to get jobs, but jobs array is empty
    runGhJsonMock.mockReturnValueOnce({
      jobs: [],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    // When no jobs, refs are set to { job_id: null, check_run_id: null }
    expect(result?.id).toBe(123)
    expect(result?.job_id).toBeNull()
    expect(result?.check_run_id).toBeNull()
  })

  it("returns null when run id is not a positive integer", () => {
    tryRunGhJsonMock
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ databaseId: 0 }]) // first run list fails (id is 0)
      .mockReturnValueOnce([]) // second run list also fails

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result).toBeNull()
  })

  it("parses response with items property for checks", () => {
    tryRunGhJsonMock.mockReturnValueOnce({
      items: [{ state: "FAILURE", link: "https://github.com/actions/runs/123" }],
    })

    runGhJsonMock.mockReturnValueOnce({
      jobs: [{ databaseId: 456, checkRunId: 789 }],
    })

    const result = findLatestWorkflowRun("aryeko/ghx-bench-fixtures", 42)

    expect(result?.id).toBe(123)
  })
})
