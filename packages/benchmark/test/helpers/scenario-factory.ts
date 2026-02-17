import type { AtomicScenario, ScenarioAssertions } from "../../src/domain/types.js"

export function makeAssertions(overrides: Partial<ScenarioAssertions> = {}): ScenarioAssertions {
  return {
    must_succeed: true,
    ...overrides,
  }
}

export function makeScenario(overrides: Partial<AtomicScenario> = {}): AtomicScenario {
  const { assertions: assertionOverrides, ...restOverrides } = overrides
  return {
    type: "atomic" as const,
    id: "test-scenario-001",
    name: "Test Scenario",
    task: "repo.view",
    input: { owner: "a", name: "b" },
    prompt_template: "do {{task}} with {{input_json}}",
    timeout_ms: 1000,
    allowed_retries: 0,
    assertions: makeAssertions(assertionOverrides),
    tags: [],
    ...restOverrides,
  }
}
