import type { WorkflowScenario } from "@bench/domain/types.js"

export function makeWorkflowScenario(overrides: Partial<WorkflowScenario> = {}): WorkflowScenario {
  const { assertions: assertionOverrides, ...restOverrides } = overrides
  return {
    type: "workflow" as const,
    id: "test-wf-001",
    name: "Test Workflow",
    prompt: "Do something with the repository.",
    expected_capabilities: ["repo.view"],
    timeout_ms: 180_000,
    allowed_retries: 0,
    assertions: {
      expected_outcome: "success",
      checkpoints: [
        {
          name: "default-checkpoint",
          verification_task: "repo.view",
          verification_input: { owner: "a", name: "b" },
          condition: "non_empty",
        },
      ],
      ...assertionOverrides,
    },
    tags: [],
    ...restOverrides,
  }
}
