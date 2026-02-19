import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@bench/runner/suite-runner.js", () => ({
  runSuite: vi.fn(async () => undefined),
}))

vi.mock("@bench/scenario/loader.js", () => ({
  loadScenarios: vi.fn(),
  loadScenarioSets: vi.fn(),
}))

import { main as benchmarkMain } from "@bench/cli/benchmark.js"
import { main as checkScenariosMain } from "@bench/cli/check-scenarios.js"
import { runSuite } from "@bench/runner/suite-runner.js"
import { loadScenarioSets, loadScenarios } from "@bench/scenario/loader.js"

describe("benchmark cli mains", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("parses args and delegates benchmark main", async () => {
    await benchmarkMain(["run", "ghx", "2", "--scenario-set", "pr-review-reads"])

    expect(runSuite).toHaveBeenCalledWith({
      mode: "ghx",
      repetitions: 2,
      scenarioFilter: null,
      scenarioSet: "pr-review-reads",
      fixtureManifestPath: null,
      seedIfMissing: false,
      providerId: null,
      modelId: null,
      outputJsonlPath: null,
      skipWarmup: false,
    })
  })

  it("forwards provider/model/output and repeated scenario filters", async () => {
    await benchmarkMain([
      "run",
      "agent_direct",
      "1",
      "--provider",
      "openai",
      "--model",
      "gpt-5.1-codex-mini",
      "--output-jsonl",
      "reports/custom.jsonl",
      "--scenario",
      "scenario-a",
      "--scenario",
      "scenario-b",
    ])

    expect(runSuite).toHaveBeenCalledWith({
      mode: "agent_direct",
      repetitions: 1,
      scenarioFilter: ["scenario-a", "scenario-b"],
      scenarioSet: null,
      fixtureManifestPath: null,
      seedIfMissing: false,
      providerId: "openai",
      modelId: "gpt-5.1-codex-mini",
      outputJsonlPath: "reports/custom.jsonl",
      skipWarmup: false,
    })
  })

  it("validates scenario count in check-scenarios main", async () => {
    const workflowScenarios = [
      {
        id: "wf-001",
        type: "workflow",
        name: "Workflow 1",
        prompt: "test",
        expected_capabilities: ["repo.view"],
        timeout_ms: 180000,
        allowed_retries: 1,
        fixture: { repo: "test/repo", bindings: {}, requires: [] },
        assertions: { expected_outcome: "success", checkpoints: [] },
        tags: ["workflow"],
      },
      {
        id: "wf-002",
        type: "workflow",
        name: "Workflow 2",
        prompt: "test",
        expected_capabilities: ["issue.view"],
        timeout_ms: 180000,
        allowed_retries: 1,
        fixture: { repo: "test/repo", bindings: {}, requires: [] },
        assertions: { expected_outcome: "success", checkpoints: [] },
        tags: ["workflow"],
      },
    ]

    vi.mocked(loadScenarios).mockResolvedValueOnce(workflowScenarios as never)
    vi.mocked(loadScenarioSets).mockResolvedValueOnce({
      default: ["wf-001", "wf-002"],
      workflows: ["wf-001", "wf-002"],
      all: ["wf-001", "wf-002"],
      "full-seeded": ["wf-001", "wf-002"],
    })

    await expect(checkScenariosMain("/tmp/test-cwd")).resolves.toBeUndefined()

    vi.mocked(loadScenarios).mockResolvedValueOnce([])
    await expect(checkScenariosMain("/tmp/test-cwd")).rejects.toThrow(
      "No benchmark scenarios found",
    )
  })
})
