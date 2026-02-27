import { bindFixtureVariables, type FixtureBindings } from "@eval/scenario/fixture-binder.js"
import type { EvalScenario } from "@eval/scenario/schema.js"
import { describe, expect, it } from "vitest"

const manifest: FixtureBindings = {
  fixtures: {
    pr_with_mixed_threads: {
      type: "pr_with_mixed_threads",
      number: 42,
      repo: "aryeko/ghx-bench-fixtures",
      branch: "bench-fixture/pr-mixed-threads-42",
    },
  },
}

const baseScenario: EvalScenario = {
  id: "pr-fix-mixed-threads-001",
  name: "Fix PR",
  description: "Fix PR",
  prompt: "Review PR #{{pr_number}} in {{repo}}",
  timeoutMs: 180000,
  allowedRetries: 0,
  tags: [],
  category: "pr",
  difficulty: "intermediate",
  fixture: {
    repo: "{{fixture_repo}}",
    requires: ["pr_with_mixed_threads"],
    bindings: {
      pr_number: "pr_with_mixed_threads.number",
      repo: "pr_with_mixed_threads.repo",
    },
    reseedPerIteration: true,
  },
  assertions: {
    checkpoints: [
      {
        id: "cp1",
        description: "test",
        task: "pr.commits.list",
        input: {
          owner: "{{owner}}",
          repo_name: "{{repo_name}}",
          pr_number: "{{pr_number}}",
        },
        condition: { type: "count_gte", value: 2 },
      },
    ],
  },
}

describe("bindFixtureVariables", () => {
  it("resolves template variables in prompt", () => {
    const bound = bindFixtureVariables(baseScenario, manifest)
    expect(bound.prompt).toBe("Review PR #42 in aryeko/ghx-bench-fixtures")
  })

  it("resolves template variables in checkpoint inputs", () => {
    const bound = bindFixtureVariables(baseScenario, manifest)
    const cp = bound.assertions.checkpoints[0]
    expect(cp).toBeDefined()
    expect(cp?.input["owner"]).toBe("aryeko")
    expect(cp?.input["repo_name"]).toBe("ghx-bench-fixtures")
    expect(cp?.input["pr_number"]).toBe("42")
  })

  it("derives owner and repo_name from repo binding", () => {
    const bound = bindFixtureVariables(baseScenario, manifest)
    const cp = bound.assertions.checkpoints[0]
    expect(cp).toBeDefined()
    // verified via checkpoint input assertions above
    expect(cp?.input["owner"]).toBe("aryeko")
    expect(cp?.input["repo_name"]).toBe("ghx-bench-fixtures")
  })

  it("returns scenario unchanged when no fixture", () => {
    const noFixture = { ...baseScenario, fixture: undefined }
    const bound = bindFixtureVariables(noFixture, manifest)
    expect(bound).toBe(noFixture)
  })

  it("throws for unresolvable binding path", () => {
    const fixture = baseScenario.fixture ?? {
      repo: "aryeko/ghx-bench-fixtures",
      requires: [],
      bindings: {},
      reseedPerIteration: false,
    }
    const badBindings: EvalScenario = {
      ...baseScenario,
      fixture: {
        ...fixture,
        bindings: { pr_number: "nonexistent.path" },
      },
    }
    expect(() => bindFixtureVariables(badBindings, manifest)).toThrow(
      'Fixture binding "pr_number" could not be resolved',
    )
  })

  it("throws for unresolved template variable in prompt", () => {
    const unresolvable: EvalScenario = {
      ...baseScenario,
      prompt: "Review PR #{{pr_number}} in {{unknown_var}}",
    }
    expect(() => bindFixtureVariables(unresolvable, manifest)).toThrow(
      "Unresolved template variable: {{unknown_var}}",
    )
  })

  it("does not mutate the original scenario", () => {
    const originalPrompt = baseScenario.prompt
    bindFixtureVariables(baseScenario, manifest)
    expect(baseScenario.prompt).toBe(originalPrompt)
  })
})
