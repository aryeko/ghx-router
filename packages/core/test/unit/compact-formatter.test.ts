import { compactChainResult, compactRunResult } from "@core/cli/formatters/compact.js"
import type { ChainResultEnvelope, ResultEnvelope } from "@core/core/contracts/envelope.js"
import { describe, expect, it } from "vitest"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOkEnvelope(overrides: Partial<ResultEnvelope> = {}): ResultEnvelope {
  return {
    ok: true,
    data: { id: 1, name: "test" },
    meta: {
      capability_id: "test-cap",
      route_used: "cli",
    },
    ...overrides,
  }
}

function makeErrorEnvelope(overrides: Partial<ResultEnvelope> = {}): ResultEnvelope {
  return {
    ok: false,
    error: {
      code: "NOT_FOUND",
      message: "Resource not found",
      retryable: false,
      details: { resource: "issue", id: 42 },
    },
    meta: {
      capability_id: "test-cap",
      route_used: "graphql",
      timings: { total_ms: 120 },
    },
    ...overrides,
  }
}

function makeChainEnvelope(
  steps: ChainResultEnvelope["results"],
  status: ChainResultEnvelope["status"] = "success",
): ChainResultEnvelope {
  const succeeded = steps.filter((s) => s.ok).length
  const failed = steps.filter((s) => !s.ok).length
  return {
    status,
    results: steps,
    meta: {
      route_used: "cli",
      total: steps.length,
      succeeded,
      failed,
    },
  }
}

// ---------------------------------------------------------------------------
// compactRunResult
// ---------------------------------------------------------------------------

describe("compactRunResult", () => {
  it("returns ok:true with data for a successful envelope", () => {
    const envelope = makeOkEnvelope({ data: { id: 99 } })
    const result = compactRunResult(envelope)

    expect(result).toMatchObject({ ok: true, data: { id: 99 } })
  })

  it("omits pagination when envelope.meta.pagination is undefined", () => {
    const envelope = makeOkEnvelope()
    const result = compactRunResult(envelope)

    expect(result.ok).toBe(true)
    expect("pagination" in result).toBe(false)
  })

  it("includes pagination when present in meta", () => {
    const pagination = { has_next_page: true, end_cursor: "abc123" }
    const envelope = makeOkEnvelope({
      meta: {
        capability_id: "test-cap",
        pagination,
      },
    })
    const result = compactRunResult(envelope)

    expect(result).toMatchObject({ ok: true, pagination })
  })

  it("handles undefined data on a successful envelope", () => {
    const envelope: ResultEnvelope = {
      ok: true,
      data: undefined,
      meta: { capability_id: "test-cap" },
    }
    const result = compactRunResult(envelope)

    expect(result).toMatchObject({ ok: true })
    expect((result as { ok: true; data: unknown }).data).toBeUndefined()
  })

  it("returns ok:false with code and message for an error envelope", () => {
    const envelope = makeErrorEnvelope()
    const result = compactRunResult(envelope)

    expect(result).toMatchObject({
      ok: false,
      error: { code: "NOT_FOUND", message: "Resource not found" },
    })
  })

  it("strips retryable field from error output", () => {
    const envelope = makeErrorEnvelope()
    const result = compactRunResult(envelope)

    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty("error.retryable")
  })

  it("strips details field from error output", () => {
    const envelope = makeErrorEnvelope()
    const result = compactRunResult(envelope)

    expect(result.ok).toBe(false)
    expect(result).not.toHaveProperty("error.details")
  })

  it("strips meta from the compact result", () => {
    const envelope = makeOkEnvelope()
    const result = compactRunResult(envelope)

    expect("meta" in result).toBe(false)
  })

  it("strips meta from error compact result", () => {
    const envelope = makeErrorEnvelope()
    const result = compactRunResult(envelope)

    expect("meta" in result).toBe(false)
  })

  it("handles different error codes", () => {
    const envelope = makeErrorEnvelope({
      error: {
        code: "AUTH",
        message: "Unauthorized",
        retryable: true,
      },
    })
    const result = compactRunResult(envelope)

    expect(result).toMatchObject({
      ok: false,
      error: { code: "AUTH", message: "Unauthorized" },
    })
  })
})

// ---------------------------------------------------------------------------
// compactChainResult
// ---------------------------------------------------------------------------

describe("compactChainResult", () => {
  it("returns status from the envelope", () => {
    const envelope = makeChainEnvelope(
      [{ task: "task-a", ok: true, data: { result: 1 } }],
      "success",
    )
    const result = compactChainResult(envelope)

    expect(result.status).toBe("success")
  })

  it("maps all-success steps: includes task and ok:true, strips data", () => {
    const envelope = makeChainEnvelope([
      { task: "task-a", ok: true, data: { id: 1 } },
      { task: "task-b", ok: true, data: { id: 2 } },
    ])
    const result = compactChainResult(envelope)

    expect(result.results).toHaveLength(2)
    expect(result.results[0]).toEqual({ task: "task-a", ok: true })
    expect(result.results[1]).toEqual({ task: "task-b", ok: true })
    expect(result.results[0]).not.toHaveProperty("data")
  })

  it("maps all-failed steps: includes task, ok:false, and error code+message", () => {
    const envelope = makeChainEnvelope(
      [
        {
          task: "task-x",
          ok: false,
          error: { code: "VALIDATION", message: "Invalid input", retryable: false },
        },
        {
          task: "task-y",
          ok: false,
          error: { code: "SERVER", message: "Internal error", retryable: true },
        },
      ],
      "failed",
    )
    const result = compactChainResult(envelope)

    expect(result.status).toBe("failed")
    expect(result.results[0]).toEqual({
      task: "task-x",
      ok: false,
      error: { code: "VALIDATION", message: "Invalid input" },
    })
    expect(result.results[1]).toEqual({
      task: "task-y",
      ok: false,
      error: { code: "SERVER", message: "Internal error" },
    })
  })

  it("handles partial results with mixed ok and failed steps", () => {
    const envelope = makeChainEnvelope(
      [
        { task: "task-a", ok: true, data: { id: 1 } },
        {
          task: "task-b",
          ok: false,
          error: { code: "NOT_FOUND", message: "Not found", retryable: false },
        },
        { task: "task-c", ok: true, data: { id: 3 } },
      ],
      "partial",
    )
    const result = compactChainResult(envelope)

    expect(result.status).toBe("partial")
    expect(result.results).toHaveLength(3)
    expect(result.results[0]).toEqual({ task: "task-a", ok: true })
    expect(result.results[1]).toEqual({
      task: "task-b",
      ok: false,
      error: { code: "NOT_FOUND", message: "Not found" },
    })
    expect(result.results[2]).toEqual({ task: "task-c", ok: true })
  })

  it("strips meta from the compact chain result", () => {
    const envelope = makeChainEnvelope([{ task: "task-a", ok: true }])
    const result = compactChainResult(envelope)

    expect("meta" in result).toBe(false)
  })

  it("strips retryable from error in chain step", () => {
    const envelope = makeChainEnvelope(
      [
        {
          task: "task-a",
          ok: false,
          error: { code: "NETWORK", message: "Timeout", retryable: true },
        },
      ],
      "failed",
    )
    const result = compactChainResult(envelope)

    expect(result.results[0]).not.toHaveProperty("error.retryable")
  })

  it("strips data from ok steps in chain result", () => {
    const envelope = makeChainEnvelope([{ task: "task-a", ok: true, data: { sensitive: "value" } }])
    const result = compactChainResult(envelope)

    expect(result.results[0]).not.toHaveProperty("data")
  })

  it("preserves the exact error code and message from failed steps", () => {
    const envelope = makeChainEnvelope(
      [
        {
          task: "my-task",
          ok: false,
          error: { code: "RATE_LIMIT", message: "Too many requests", retryable: true },
        },
      ],
      "failed",
    )
    const result = compactChainResult(envelope)

    expect(result.results[0]).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMIT", message: "Too many requests" },
    })
  })

  it("handles an empty results array", () => {
    const envelope: ChainResultEnvelope = {
      status: "success",
      results: [],
      meta: { route_used: "cli", total: 0, succeeded: 0, failed: 0 },
    }
    const result = compactChainResult(envelope)

    expect(result.status).toBe("success")
    expect(result.results).toEqual([])
  })
})
