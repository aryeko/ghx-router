import { beforeEach, describe, expect, it, vi } from "vitest"

const { loadScenariosMock, loadScenarioSetsMock } = vi.hoisted(() => ({
  loadScenariosMock: vi.fn(),
  loadScenarioSetsMock: vi.fn(),
}))

vi.mock("@bench/scenario/loader.js", () => ({
  loadScenarios: loadScenariosMock,
  loadScenarioSets: loadScenarioSetsMock,
}))

import { main } from "@bench/cli/check-scenarios.js"

function createWorkflowScenario(id: string) {
  return {
    id,
    type: "workflow",
    name: id,
    prompt: "test prompt",
    expected_capabilities: ["repo.view"],
    timeout_ms: 180000,
    allowed_retries: 1,
    fixture: { repo: "test/repo", bindings: {}, requires: [] },
    assertions: { expected_outcome: "success", checkpoints: [] },
    tags: ["workflow"],
  }
}

function createValidFixture() {
  const ids = ["wf-001", "wf-002"]
  const scenarios = ids.map((id) => createWorkflowScenario(id))

  return {
    scenarios,
    sets: {
      default: ids,
      workflows: ids,
      all: ids,
      "full-seeded": ids,
    },
  }
}

describe("check-scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("passes for valid workflow scenarios and sets", async () => {
    const fixture = createValidFixture()
    loadScenariosMock.mockResolvedValue(fixture.scenarios)
    loadScenarioSetsMock.mockResolvedValue(fixture.sets)

    await expect(main("/tmp/benchmark")).resolves.toBeUndefined()
  })

  it("fails when scenario set references unknown scenario id", async () => {
    const fixture = createValidFixture()
    loadScenariosMock.mockResolvedValue(fixture.scenarios)
    loadScenarioSetsMock.mockResolvedValue({
      ...fixture.sets,
      default: ["missing-001"],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("unknown scenario id")
  })

  it("fails when scenario is orphaned from all sets", async () => {
    const fixture = createValidFixture()
    loadScenariosMock.mockResolvedValue([
      ...fixture.scenarios,
      createWorkflowScenario("orphan-001"),
    ])
    loadScenarioSetsMock.mockResolvedValue(fixture.sets)

    await expect(main("/tmp/benchmark")).rejects.toThrow("orphan scenario")
  })

  it("fails when no scenarios are loaded", async () => {
    loadScenariosMock.mockResolvedValue([])
    loadScenarioSetsMock.mockResolvedValue({
      default: [],
      workflows: [],
      all: [],
      "full-seeded": [],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("No benchmark scenarios found")
  })

  it("fails when required sets are missing", async () => {
    const fixture = createValidFixture()
    loadScenariosMock.mockResolvedValue(fixture.scenarios)
    loadScenarioSetsMock.mockResolvedValue({
      default: fixture.sets.default,
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("Missing required scenario set")
  })

  it("fails when scenario ids are duplicated", async () => {
    const scenario = createWorkflowScenario("wf-001")
    loadScenariosMock.mockResolvedValue([scenario, { ...scenario, name: "duplicate" }])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["wf-001"],
      workflows: ["wf-001"],
      all: ["wf-001"],
      "full-seeded": ["wf-001"],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("Duplicate scenario id")
  })
})
