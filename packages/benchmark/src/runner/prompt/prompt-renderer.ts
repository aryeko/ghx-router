import type { BenchmarkMode, WorkflowScenario } from "@bench/domain/types.js"

export function renderWorkflowPrompt(scenario: WorkflowScenario, _mode: BenchmarkMode): string {
  return scenario.prompt
}
