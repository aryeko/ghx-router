import { validateScenario } from "@bench/scenario/schema.js"
import { describe, expect, it } from "vitest"

describe("validateScenario", () => {
  it("accepts a valid workflow scenario", () => {
    const parsed = validateScenario({
      type: "workflow",
      id: "pr-review-wf-001",
      name: "PR review workflow",
      prompt: "Resolve review threads on PR #42 in aryeko/ghx-bench-fixtures.",
      expected_capabilities: ["pr.thread.resolve"],
      timeout_ms: 90000,
      allowed_retries: 0,
      fixture: {
        repo: "aryeko/ghx-bench-fixtures",
        bindings: {
          "input.owner": "repo.owner",
          "input.name": "repo.name",
          "input.prNumber": "resources.pr.number",
        },
        requires: ["repo", "pr"],
      },
      assertions: {
        expected_outcome: "success",
        checkpoints: [
          {
            name: "check-threads-resolved",
            verification_task: "pr.view",
            verification_input: { owner: "aryeko", name: "ghx-bench-fixtures", prNumber: 42 },
            condition: "non_empty",
          },
        ],
      },
      tags: ["pr", "review", "workflow"],
    })

    expect(parsed.id).toBe("pr-review-wf-001")
  })

  it("rejects fixture bindings with invalid destination path", () => {
    expect(() =>
      validateScenario({
        type: "workflow",
        id: "repo-view-wf-001",
        name: "Bindings path invalid",
        prompt: "Do something.",
        expected_capabilities: ["repo.view"],
        timeout_ms: 60000,
        allowed_retries: 0,
        fixture: {
          repo: "aryeko/ghx-bench-fixtures",
          bindings: {
            owner: "repo.owner",
          },
        },
        assertions: {
          expected_outcome: "success",
          checkpoints: [
            {
              name: "check",
              verification_task: "repo.view",
              verification_input: { owner: "a", name: "b" },
              condition: "non_empty",
            },
          ],
        },
        tags: [],
      }),
    ).toThrow("fixture binding destination must start with 'input.'")
  })

  it("rejects invalid timeout", () => {
    expect(() =>
      validateScenario({
        type: "workflow",
        id: "bad-timeout-wf-001",
        name: "Bad timeout",
        prompt: "Do something.",
        expected_capabilities: ["repo.view"],
        timeout_ms: 0,
        allowed_retries: 0,
        assertions: {
          expected_outcome: "success",
          checkpoints: [
            {
              name: "check",
              verification_task: "repo.view",
              verification_input: {},
              condition: "non_empty",
            },
          ],
        },
        tags: [],
      }),
    ).toThrow()
  })

  it("rejects scenario with missing type field", () => {
    expect(() =>
      validateScenario({
        id: "repo-view-wf-001",
        name: "Missing type",
        prompt: "Do something.",
        expected_capabilities: ["repo.view"],
        timeout_ms: 60000,
        allowed_retries: 0,
        assertions: {
          expected_outcome: "success",
          checkpoints: [
            {
              name: "check",
              verification_task: "repo.view",
              verification_input: {},
              condition: "non_empty",
            },
          ],
        },
        tags: [],
      }),
    ).toThrow()
  })
})
