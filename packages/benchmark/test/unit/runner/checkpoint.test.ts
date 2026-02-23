import type { WorkflowCheckpoint } from "@bench/domain/types.js"
import { evaluateCheckpoints, evaluateCondition } from "@bench/runner/checkpoint.js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const executeTaskMock = vi.hoisted(() => vi.fn())
const createGithubClientFromTokenMock = vi.hoisted(() => vi.fn(() => ({})))

vi.mock("@ghx-dev/core", () => ({
  executeTask: executeTaskMock,
  createGithubClientFromToken: createGithubClientFromTokenMock,
}))

function makeCheckpoint(overrides: Partial<WorkflowCheckpoint> = {}): WorkflowCheckpoint {
  return {
    name: "test-checkpoint",
    verification_task: "list-issues",
    verification_input: { repo: "owner/repo" },
    condition: "non_empty",
    ...overrides,
  }
}

describe("evaluateCheckpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    createGithubClientFromTokenMock.mockReturnValue({})
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns {allPassed:true} when all checkpoints pass", async () => {
    executeTaskMock.mockResolvedValue({ ok: true, data: [{ id: 1 }] })

    const checkpoints = [makeCheckpoint({ condition: "non_empty" })]
    const result = await evaluateCheckpoints(checkpoints, "token-abc")

    expect(result.allPassed).toBe(true)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]?.passed).toBe(true)
  })

  it("returns {allPassed:false} when condition not met", async () => {
    executeTaskMock.mockResolvedValue({ ok: true, data: [] })

    const checkpoints = [makeCheckpoint({ condition: "non_empty" })]
    const promise = evaluateCheckpoints(checkpoints, "token-abc")
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.allPassed).toBe(false)
    expect(result.results[0]?.passed).toBe(false)
  })

  it("returns {allPassed:false} when executeTask returns ok:false", async () => {
    executeTaskMock.mockResolvedValue({ ok: false, error: "not found" })

    const checkpoints = [makeCheckpoint()]
    const promise = evaluateCheckpoints(checkpoints, "token-abc")
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.allPassed).toBe(false)
    expect(result.results[0]?.passed).toBe(false)
  })

  it("catches thrown errors and marks checkpoint as failed", async () => {
    executeTaskMock.mockRejectedValue(new Error("network error"))

    const checkpoints = [makeCheckpoint()]
    const promise = evaluateCheckpoints(checkpoints, "token-abc")
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.allPassed).toBe(false)
    expect(result.results[0]?.passed).toBe(false)
    expect(result.results[0]?.data).toEqual({ error: "network error" })
  })

  it("resolves {items:[...]} wrapper via resolveCheckpointData", async () => {
    executeTaskMock.mockResolvedValue({ ok: true, data: { items: [{ id: 1 }, { id: 2 }] } })

    const checkpoints = [makeCheckpoint({ condition: "count_gte", expected_value: 2 })]
    const result = await evaluateCheckpoints(checkpoints, "token-abc")

    expect(result.allPassed).toBe(true)
    expect(result.results[0]?.data).toEqual([{ id: 1 }, { id: 2 }])
  })

  it("extracts verification_field from result data before condition evaluation", async () => {
    executeTaskMock.mockResolvedValue({
      ok: true,
      data: { labels: ["enhancement", "bug"], title: "Some issue" },
    })

    const checkpoints = [
      makeCheckpoint({ condition: "count_eq", expected_value: 2, verification_field: "labels" }),
    ]
    const result = await evaluateCheckpoints(checkpoints, "token-abc")

    expect(result.allPassed).toBe(true)
    expect(result.results[0]?.passed).toBe(true)
    expect(result.results[0]?.data).toEqual(["enhancement", "bug"])
  })

  it("fails count_eq when extracted array has wrong length", async () => {
    executeTaskMock.mockResolvedValue({
      ok: true,
      data: { labels: ["enhancement"], title: "Some issue" },
    })

    const checkpoints = [
      makeCheckpoint({ condition: "count_eq", expected_value: 2, verification_field: "labels" }),
    ]
    const promise = evaluateCheckpoints(checkpoints, "token-abc")
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.allPassed).toBe(false)
    expect(result.results[0]?.passed).toBe(false)
  })

  it("returns null when verification_field is absent from result data", async () => {
    executeTaskMock.mockResolvedValue({
      ok: true,
      data: { title: "Some issue" },
    })

    const checkpoints = [makeCheckpoint({ condition: "non_empty", verification_field: "labels" })]
    const promise = evaluateCheckpoints(checkpoints, "token-abc")
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result.allPassed).toBe(false)
    expect(result.results[0]?.data).toBeNull()
  })
})

describe("evaluateCondition", () => {
  describe("empty", () => {
    it("returns true for empty array", () => {
      expect(evaluateCondition("empty", [])).toBe(true)
    })

    it("returns true for null", () => {
      expect(evaluateCondition("empty", null)).toBe(true)
    })

    it("returns true for undefined", () => {
      expect(evaluateCondition("empty", undefined)).toBe(true)
    })

    it("returns false for non-empty array", () => {
      expect(evaluateCondition("empty", [1, 2, 3])).toBe(false)
    })

    it("returns false for object", () => {
      expect(evaluateCondition("empty", { a: 1 })).toBe(false)
    })
  })

  describe("non_empty", () => {
    it("returns true for non-empty array", () => {
      expect(evaluateCondition("non_empty", [1, 2, 3])).toBe(true)
    })

    it("returns true for object", () => {
      expect(evaluateCondition("non_empty", { a: 1 })).toBe(true)
    })

    it("returns false for empty array", () => {
      expect(evaluateCondition("non_empty", [])).toBe(false)
    })

    it("returns false for null", () => {
      expect(evaluateCondition("non_empty", null)).toBe(false)
    })

    it("returns false for undefined", () => {
      expect(evaluateCondition("non_empty", undefined)).toBe(false)
    })
  })

  describe("count_gte", () => {
    it("returns true when array length >= expected", () => {
      expect(evaluateCondition("count_gte", [1, 2, 3], 3)).toBe(true)
      expect(evaluateCondition("count_gte", [1, 2, 3], 2)).toBe(true)
    })

    it("returns false when array length < expected", () => {
      expect(evaluateCondition("count_gte", [1, 2], 3)).toBe(false)
    })

    it("returns false for non-array", () => {
      expect(evaluateCondition("count_gte", { a: 1 }, 1)).toBe(false)
    })
  })

  describe("count_eq", () => {
    it("returns true when array length equals expected", () => {
      expect(evaluateCondition("count_eq", [1, 2, 3], 3)).toBe(true)
    })

    it("returns false when array length differs", () => {
      expect(evaluateCondition("count_eq", [1, 2, 3], 2)).toBe(false)
    })

    it("returns false for non-array", () => {
      expect(evaluateCondition("count_eq", { a: 1 }, 1)).toBe(false)
    })
  })

  describe("field_equals", () => {
    it("returns true when all expected fields match", () => {
      const data = { id: "123", status: "open" }
      const expected = { id: "123", status: "open" }
      expect(evaluateCondition("field_equals", data, expected)).toBe(true)
    })

    it("returns true for subset match", () => {
      const data = { id: "123", status: "open", other: "value" }
      const expected = { id: "123", status: "open" }
      expect(evaluateCondition("field_equals", data, expected)).toBe(true)
    })

    it("returns false when any expected field differs", () => {
      const data = { id: "123", status: "open" }
      const expected = { id: "123", status: "closed" }
      expect(evaluateCondition("field_equals", data, expected)).toBe(false)
    })

    it("returns false for non-objects", () => {
      expect(evaluateCondition("field_equals", [1, 2, 3], { a: 1 })).toBe(false)
      expect(evaluateCondition("field_equals", { a: 1 }, [1, 2, 3])).toBe(false)
    })

    it("handles number and boolean primitives correctly", () => {
      const data = { count: 42, active: true }
      expect(evaluateCondition("field_equals", data, { count: 42, active: true })).toBe(true)
      expect(evaluateCondition("field_equals", data, { count: 43 })).toBe(false)
      expect(evaluateCondition("field_equals", data, { active: false })).toBe(false)
    })
  })
})
