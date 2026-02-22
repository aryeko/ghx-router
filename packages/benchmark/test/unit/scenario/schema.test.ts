import { validateScenario } from "@bench/scenario/schema.js"
import { describe, expect, it } from "vitest"

function createValidWorkflowScenario(): Record<string, unknown> {
  return {
    type: "workflow",
    id: "repo-view-wf-001",
    name: "Repo view workflow",
    prompt: "Resolve review threads on PR #42 in aryeko/ghx-bench-fixtures.",
    expected_capabilities: ["pr.thread.resolve"],
    timeout_ms: 180_000,
    allowed_retries: 0,
    fixture: {
      repo: "aryeko/ghx-bench-fixtures",
      bindings: {
        "input.owner": "repo.owner",
      },
    },
    assertions: {
      expected_outcome: "success",
      checkpoints: [
        {
          name: "check-repo",
          verification_task: "repo.view",
          verification_input: { owner: "aryeko", name: "ghx-bench-fixtures" },
          condition: "non_empty",
        },
      ],
    },
    tags: ["repo", "view"],
  }
}

describe("scenario schema validation", () => {
  it("accepts a valid workflow scenario", () => {
    const scenario = createValidWorkflowScenario()
    const parsed = validateScenario(scenario)
    expect(parsed.id).toBe("repo-view-wf-001")
  })

  it("rejects scenario with invalid id format", () => {
    const scenario = createValidWorkflowScenario()
    scenario.id = "bad-id"
    expect(() => validateScenario(scenario)).toThrow()
  })

  it("requires at least one checkpoint", () => {
    const scenario = createValidWorkflowScenario()
    scenario.assertions = {
      expected_outcome: "success",
      checkpoints: [],
    }
    expect(() => validateScenario(scenario)).toThrow()
  })

  it("requires expected_value for count_gte condition", () => {
    const scenario = createValidWorkflowScenario()
    scenario.assertions = {
      expected_outcome: "success",
      checkpoints: [
        {
          name: "check-count",
          verification_task: "issue.list",
          verification_input: { owner: "a", name: "b" },
          condition: "count_gte",
        },
      ],
    }
    expect(() => validateScenario(scenario)).toThrow("must specify expected_value")
  })

  it("accepts count_gte checkpoint with expected_value", () => {
    const scenario = createValidWorkflowScenario()
    scenario.assertions = {
      expected_outcome: "success",
      checkpoints: [
        {
          name: "check-count",
          verification_task: "issue.list",
          verification_input: { owner: "a", name: "b" },
          condition: "count_gte",
          expected_value: 3,
        },
      ],
    }
    expect(() => validateScenario(scenario)).not.toThrow()
  })

  it("rejects fixture bindings with non-dotted source paths", () => {
    const scenario = createValidWorkflowScenario()
    scenario.fixture = {
      repo: "aryeko/ghx-bench-fixtures",
      bindings: {
        "input.owner": "owner",
      },
    }

    expect(() => validateScenario(scenario)).toThrow(
      "fixture binding source must be a dotted manifest path",
    )
  })

  it("rejects fixture bindings with destination paths outside input", () => {
    const scenario = createValidWorkflowScenario()
    scenario.fixture = {
      repo: "aryeko/ghx-bench-fixtures",
      bindings: {
        owner: "repo.owner",
      },
    }

    expect(() => validateScenario(scenario)).toThrow(
      "fixture binding destination must start with 'input.'",
    )
  })

  it("accepts fixture config when bindings are omitted", () => {
    const scenario = createValidWorkflowScenario()
    scenario.fixture = {
      repo: "aryeko/ghx-bench-fixtures",
      branch: "main",
    }

    expect(() => validateScenario(scenario)).not.toThrow()
  })

  it("requires at least one expected capability", () => {
    const scenario = createValidWorkflowScenario()
    scenario.expected_capabilities = []
    expect(() => validateScenario(scenario)).toThrow()
  })
})
