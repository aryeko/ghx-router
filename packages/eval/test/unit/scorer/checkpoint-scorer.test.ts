import type { EvalScenario } from "@eval/scenario/schema.js"
import { CheckpointScorer } from "@eval/scorer/checkpoint-scorer.js"
import type { BaseScenario, ScorerContext } from "@ghx-dev/agent-profiler"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock @ghx-dev/core executeTask
vi.mock("@ghx-dev/core", () => ({
  executeTask: vi.fn(),
  createGithubClientFromToken: vi.fn(() => ({})),
}))

import { executeTask } from "@ghx-dev/core"

const mockExecuteTask = vi.mocked(executeTask)

const dummyContext: ScorerContext = {
  agentOutput: "I completed the task",
  trace: null,
  mode: "ghx",
  model: "test-model",
  iteration: 1,
  metadata: {},
}

function makeScenario(checkpoints: EvalScenario["assertions"]["checkpoints"]): BaseScenario {
  return {
    id: "test-001",
    name: "test",
    description: "test",
    prompt: "test",
    timeoutMs: 60000,
    allowedRetries: 0,
    tags: [],
    extensions: {},
    // EvalScenario extra fields (passed through as BaseScenario)
    category: "pr",
    difficulty: "basic",
    assertions: { checkpoints },
  } as unknown as BaseScenario
}

describe("CheckpointScorer", () => {
  const scorer = new CheckpointScorer("test-token")

  beforeEach(() => {
    mockExecuteTask.mockReset()
  })

  it("has id 'checkpoint'", () => {
    expect(scorer.id).toBe("checkpoint")
  })

  it("returns success: true when all checkpoints pass", async () => {
    mockExecuteTask.mockResolvedValue({ ok: true, data: [1, 2, 3], error: null, meta: {} })

    const scenario = makeScenario([
      {
        id: "cp1",
        description: "count gte 2",
        task: "pr.commits.list",
        input: { owner: "o", repo: "r", pr_number: "1" },
        condition: { type: "count_gte", value: 2 },
      },
    ])

    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.success).toBe(true)
    expect(result.passed).toBe(1)
    expect(result.total).toBe(1)
    expect(result.details[0]?.passed).toBe(true)
  })

  it("returns success: false when a checkpoint fails", async () => {
    mockExecuteTask.mockResolvedValue({ ok: true, data: [1], error: null, meta: {} })

    const scenario = makeScenario([
      {
        id: "cp1",
        description: "need >= 3",
        task: "pr.commits.list",
        input: {},
        condition: { type: "count_gte", value: 3 },
      },
    ])

    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.success).toBe(false)
    expect(result.passed).toBe(0)
  })

  it("handles executeTask returning ok: false", async () => {
    mockExecuteTask.mockResolvedValue({
      ok: false,
      data: null,
      error: { message: "Not found", code: "NOT_FOUND" },
      meta: {},
    })

    const scenario = makeScenario([
      {
        id: "cp1",
        description: "test",
        task: "pr.view",
        input: {},
        condition: { type: "non_empty" },
      },
    ])

    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.success).toBe(false)
    expect(result.details[0]?.error).toBe("Not found")
  })

  it("handles executeTask throwing", async () => {
    mockExecuteTask.mockRejectedValue(new Error("Network error"))

    const scenario = makeScenario([
      {
        id: "cp1",
        description: "test",
        task: "pr.view",
        input: {},
        condition: { type: "non_empty" },
      },
    ])

    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.success).toBe(false)
    expect(result.details[0]?.error).toBe("Network error")
  })

  it("evaluates non_empty condition correctly", async () => {
    // Arrays
    mockExecuteTask.mockResolvedValueOnce({ ok: true, data: [1, 2], error: null, meta: {} })
    mockExecuteTask.mockResolvedValueOnce({ ok: true, data: [], error: null, meta: {} })

    const s1 = makeScenario([
      { id: "c", description: "d", task: "t", input: {}, condition: { type: "non_empty" } },
    ])
    const s2 = makeScenario([
      { id: "c", description: "d", task: "t", input: {}, condition: { type: "non_empty" } },
    ])

    const r1 = await scorer.evaluate(s1, dummyContext)
    const r2 = await scorer.evaluate(s2, dummyContext)
    expect(r1.details[0]?.passed).toBe(true)
    expect(r2.details[0]?.passed).toBe(false)
  })

  it("evaluates count_eq condition correctly", async () => {
    mockExecuteTask.mockResolvedValue({ ok: true, data: [1, 2, 3], error: null, meta: {} })

    const scenario = makeScenario([
      {
        id: "c",
        description: "d",
        task: "t",
        input: {},
        condition: { type: "count_eq", value: 3 },
      },
    ])
    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.details[0]?.passed).toBe(true)
  })

  it("evaluates field_equals condition correctly", async () => {
    mockExecuteTask.mockResolvedValue({
      ok: true,
      data: { state: "closed", title: "Fix bug" },
      error: null,
      meta: {},
    })

    const scenario = makeScenario([
      {
        id: "c",
        description: "d",
        task: "pr.view",
        input: {},
        condition: { type: "field_equals", path: "state", value: "closed" },
      },
    ])
    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.details[0]?.passed).toBe(true)
  })

  it("evaluates field_contains condition correctly", async () => {
    mockExecuteTask.mockResolvedValue({
      ok: true,
      data: { body: "This fixes the authentication bug" },
      error: null,
      meta: {},
    })

    const scenario = makeScenario([
      {
        id: "c",
        description: "d",
        task: "pr.view",
        input: {},
        condition: { type: "field_contains", path: "body", value: "authentication" },
      },
    ])
    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.details[0]?.passed).toBe(true)
  })

  it("evaluates custom condition as false (v1 not implemented)", async () => {
    mockExecuteTask.mockResolvedValue({ ok: true, data: "anything", error: null, meta: {} })

    const scenario = makeScenario([
      {
        id: "c",
        description: "d",
        task: "t",
        input: {},
        condition: { type: "custom", scorer: "my-scorer" },
      },
    ])
    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.details[0]?.passed).toBe(false)
  })

  it("handles multiple checkpoints with mixed results", async () => {
    mockExecuteTask
      .mockResolvedValueOnce({ ok: true, data: [1, 2], error: null, meta: {} })
      .mockResolvedValueOnce({ ok: true, data: [], error: null, meta: {} })

    const scenario = makeScenario([
      {
        id: "c1",
        description: "d1",
        task: "t",
        input: {},
        condition: { type: "count_gte", value: 2 },
      },
      { id: "c2", description: "d2", task: "t", input: {}, condition: { type: "non_empty" } },
    ])
    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.total).toBe(2)
    expect(result.passed).toBe(1)
    expect(result.success).toBe(false)
  })

  it("evaluates empty condition correctly for empty array", async () => {
    mockExecuteTask.mockResolvedValue({ ok: true, data: [], error: null, meta: {} })

    const scenario = makeScenario([
      { id: "c", description: "d", task: "t", input: {}, condition: { type: "empty" } },
    ])
    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.details[0]?.passed).toBe(true)
  })

  it("evaluates empty condition correctly for non-empty array", async () => {
    mockExecuteTask.mockResolvedValue({ ok: true, data: [1], error: null, meta: {} })

    const scenario = makeScenario([
      { id: "c", description: "d", task: "t", input: {}, condition: { type: "empty" } },
    ])
    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.details[0]?.passed).toBe(false)
  })

  it("returns success: false when there are no checkpoints", async () => {
    const scenario = makeScenario([])
    const result = await scorer.evaluate(scenario, dummyContext)
    expect(result.success).toBe(false)
    expect(result.total).toBe(0)
    expect(result.passed).toBe(0)
  })

  it("passes githubToken when calling executeTask", async () => {
    mockExecuteTask.mockResolvedValue({ ok: true, data: [1], error: null, meta: {} })

    const scenario = makeScenario([
      { id: "c", description: "d", task: "pr.list", input: {}, condition: { type: "non_empty" } },
    ])
    await scorer.evaluate(scenario, dummyContext)
    expect(mockExecuteTask).toHaveBeenCalledWith(
      { task: "pr.list", input: {} },
      expect.objectContaining({ githubToken: "test-token", skipGhPreflight: true }),
    )
  })
})
