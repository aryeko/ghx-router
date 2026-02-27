import { EvalScenarioSchema } from "@eval/scenario/schema.js"
import { describe, expect, it } from "vitest"

const validScenario = {
  id: "pr-fix-mixed-threads-001",
  name: "Fix PR with Mixed Review Threads",
  description: "Agent fixes unresolved threads",
  prompt: "Review PR #{{pr_number}} and fix outstanding comments",
  timeoutMs: 180000,
  allowedRetries: 1,
  tags: ["pr", "review"],
  category: "pr",
  difficulty: "intermediate",
  fixture: {
    repo: "aryeko/ghx-bench-fixtures",
    requires: ["pr_with_mixed_threads"],
    bindings: { pr_number: "pr_with_mixed_threads.number" },
    reseedPerIteration: true,
  },
  assertions: {
    checkpoints: [
      {
        id: "new-commit-pushed",
        description: "A new commit was pushed",
        task: "pr.commits.list",
        input: { owner: "{{owner}}", repo: "{{repo_name}}", pr_number: "{{pr_number}}" },
        condition: { type: "count_gte", value: 2 },
      },
    ],
    expectedCapabilities: ["pr.view", "pr.commits.list"],
  },
}

describe("EvalScenarioSchema", () => {
  it("parses a valid full scenario", () => {
    const result = EvalScenarioSchema.parse(validScenario)
    expect(result.id).toBe("pr-fix-mixed-threads-001")
    expect(result.category).toBe("pr")
    expect(result.assertions.checkpoints).toHaveLength(1)
  })

  it("applies default allowedRetries = 0", () => {
    const s = { ...validScenario }
    delete (s as Record<string, unknown>)["allowedRetries"]
    const result = EvalScenarioSchema.parse(s)
    expect(result.allowedRetries).toBe(0)
  })

  it("applies default tags = []", () => {
    const s = { ...validScenario }
    delete (s as Record<string, unknown>)["tags"]
    const result = EvalScenarioSchema.parse(s)
    expect(result.tags).toEqual([])
  })

  it("rejects invalid ID format (no number suffix)", () => {
    expect(() =>
      EvalScenarioSchema.parse({ ...validScenario, id: "pr-fix-mixed-threads" }),
    ).toThrow()
  })

  it("rejects invalid ID format (uppercase)", () => {
    expect(() => EvalScenarioSchema.parse({ ...validScenario, id: "PR-fix-001" })).toThrow()
  })

  it("rejects invalid category", () => {
    expect(() => EvalScenarioSchema.parse({ ...validScenario, category: "other" })).toThrow()
  })

  it("rejects invalid difficulty", () => {
    expect(() => EvalScenarioSchema.parse({ ...validScenario, difficulty: "hard" })).toThrow()
  })

  it("accepts scenario without fixture", () => {
    const s = { ...validScenario }
    delete (s as Record<string, unknown>)["fixture"]
    const result = EvalScenarioSchema.parse(s)
    expect(result.fixture).toBeUndefined()
  })

  it("rejects field_equals with object value", () => {
    expect(() =>
      EvalScenarioSchema.parse({
        ...validScenario,
        assertions: {
          checkpoints: [
            {
              id: "cp-1",
              description: "test",
              task: "pr.list",
              input: {},
              condition: { type: "field_equals", path: "state", value: { nested: true } },
            },
          ],
        },
      }),
    ).toThrow()
  })

  it("parses all checkpoint condition types", () => {
    const conditions = [
      { type: "non_empty" },
      { type: "empty" },
      { type: "count_gte", value: 2 },
      { type: "count_eq", value: 1 },
      { type: "field_equals", path: "state", value: "closed" },
      { type: "field_contains", path: "body", value: "fix" },
      { type: "custom", scorer: "my-scorer" },
    ]
    for (const condition of conditions) {
      const scenario = {
        ...validScenario,
        assertions: {
          checkpoints: [{ ...validScenario.assertions.checkpoints[0], condition }],
        },
      }
      expect(() => EvalScenarioSchema.parse(scenario)).not.toThrow()
    }
  })
})
