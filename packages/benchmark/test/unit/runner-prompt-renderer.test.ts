import type { WorkflowScenario } from "@bench/domain/types.js"
import { renderWorkflowPrompt } from "@bench/runner/prompt/prompt-renderer.js"
import { describe, expect, it } from "vitest"

const workflowScenario: WorkflowScenario = {
  type: "workflow",
  id: "test-wf-001",
  name: "Test workflow",
  prompt: "Fix the review comments on PR #42.",
  expected_capabilities: ["pr.thread.resolve"],
  timeout_ms: 180_000,
  allowed_retries: 1,
  assertions: {
    expected_outcome: "success",
    checkpoints: [],
  },
  tags: ["workflow"],
}

describe("renderWorkflowPrompt", () => {
  it.each([
    "ghx",
    "agent_direct",
    "mcp",
  ] as const)("returns bare prompt for %s mode (constraints live in system instructions)", (mode) => {
    const result = renderWorkflowPrompt(workflowScenario, mode)

    expect(result).toBe("Fix the review comments on PR #42.")
  })
})
