import { describe, expect, it } from "vitest"

import { validateScenario } from "../../src/scenario/schema.js"

describe("validateScenario", () => {
  it("accepts a valid scenario", () => {
    const parsed = validateScenario({
      id: "pr-view-001",
      name: "View pull request details",
      task: "pr.view",
      input: {
        repo: "go-modkit/modkit",
        pr_number: 232
      },
      prompt_template: "Execute task {{task}} with {{input_json}}",
      timeout_ms: 90000,
      allowed_retries: 0,
      fixture: {
        repo: "go-modkit/modkit"
      },
      assertions: {
        must_succeed: true,
        expect_valid_output: true,
        require_tool_calls: true,
        min_tool_calls: 1,
        required_fields: ["success", "data", "error", "meta"],
          required_data_fields: ["number", "title", "state"]
        },
      tags: ["pr", "view", "thin-slice"]
    })

    expect(parsed.id).toBe("pr-view-001")
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
        tags: []
      })
    ).toThrow()
  })
})
