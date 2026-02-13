import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("../../src/runner/suite-runner.js", () => ({
  runSuite: vi.fn(async () => undefined)
}))

vi.mock("../../src/scenario/loader.js", () => ({
  loadScenarios: vi.fn()
}))

import { runSuite } from "../../src/runner/suite-runner.js"
import { loadScenarios } from "../../src/scenario/loader.js"
import { main as benchmarkMain } from "../../src/cli/benchmark.js"
import { main as checkScenariosMain } from "../../src/cli/check-scenarios.js"

describe("benchmark cli mains", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("parses args and delegates benchmark main", async () => {
    await benchmarkMain(["run", "ghx_router", "2", "--scenario", "repo-view-001"])

    expect(runSuite).toHaveBeenCalledWith({
      mode: "ghx_router",
      repetitions: 2,
      scenarioFilter: "repo-view-001"
    })
  })

  it("validates scenario count in check-scenarios main", async () => {
    vi.mocked(loadScenarios).mockResolvedValueOnce([
      {
        id: "repo-view-001",
        name: "Repo",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      }
    ] as never)

    await expect(checkScenariosMain("/tmp/test-cwd")).resolves.toBeUndefined()

    vi.mocked(loadScenarios).mockResolvedValueOnce([])
    await expect(checkScenariosMain("/tmp/test-cwd")).rejects.toThrow("No benchmark scenarios found")
  })
})
