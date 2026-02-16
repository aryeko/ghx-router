import { describe, expect, it } from "vitest"

import { validateScenario } from "../../src/scenario/schema.js"

describe("validateScenario", () => {
  it("accepts a valid scenario", () => {
    const parsed = validateScenario({
      id: "pr-view-001",
      name: "View pull request details",
      task: "pr.view",
      input: {
        repo: "aryeko/ghx-bench-fixtures",
        pr_number: 232,
      },
      prompt_template: "Execute task {{task}} with {{input_json}}",
      timeout_ms: 90000,
      allowed_retries: 0,
      fixture: {
        repo: "aryeko/ghx-bench-fixtures",
        bindings: {
          "input.owner": "repo.owner",
          "input.name": "repo.name",
          "input.pr_number": "resources.pr.number",
        },
        requires: ["repo", "pr"],
      },
      assertions: {
        must_succeed: true,
        expect_valid_output: true,
        require_tool_calls: true,
        min_tool_calls: 1,
        required_fields: ["success", "data", "error", "meta"],
        required_data_fields: ["number", "title", "state"],
      },
      tags: ["pr", "view", "thin-slice"],
    })

    expect(parsed.id).toBe("pr-view-001")
  })

  it("rejects fixture bindings with invalid destination path", () => {
    expect(() =>
      validateScenario({
        id: "repo-view-bindings-001",
        name: "Bindings path invalid",
        task: "repo.view",
        input: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
        },
        prompt_template: "Execute task {{task}} with {{input_json}}",
        timeout_ms: 60000,
        allowed_retries: 0,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          bindings: {
            owner: "repo.owner",
          },
        },
        assertions: {
          must_succeed: true,
        },
        tags: ["repo", "view"],
      }),
    ).toThrow("fixture binding destination must start with 'input.'")
  })

  it("rejects invalid timeout", () => {
    expect(() =>
      validateScenario({
        id: "bad",
        name: "Bad",
        task: "pr.view",
        input: {},
        prompt_template: "x",
        timeout_ms: 0,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: [],
      }),
    ).toThrow()
  })

  it("rejects scenarios where max_tool_calls is below min_tool_calls", () => {
    expect(() =>
      validateScenario({
        id: "bad-tool-window",
        name: "Bad tool call bounds",
        task: "repo.view",
        input: {
          owner: "aryeko",
          name: "ghx-bench-fixtures",
        },
        prompt_template: "Execute task {{task}} with {{input_json}}",
        timeout_ms: 60000,
        allowed_retries: 0,
        assertions: {
          must_succeed: true,
          require_tool_calls: true,
          min_tool_calls: 2,
          max_tool_calls: 1,
        },
        tags: ["repo", "view"],
      }),
    ).toThrow("max_tool_calls must be greater than or equal to min_tool_calls")
  })
})
