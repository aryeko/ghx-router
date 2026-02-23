import type { Scenario, WorkflowScenario } from "@bench/domain/types.js"

export function makeMockScenario(id: string, overrides: Partial<Scenario> = {}): Scenario {
  return {
    type: "workflow" as const,
    id,
    name: `Scenario ${id}`,
    prompt: "Do some work",
    expected_capabilities: [],
    timeout_ms: 60000,
    allowed_retries: 0,
    assertions: {
      expected_outcome: "success",
      checkpoints: [],
    },
    tags: [],
    ...overrides,
  }
}

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
