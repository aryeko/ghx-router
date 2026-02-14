import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("../../src/runner/suite-runner.js", () => ({
  runSuite: vi.fn(async () => undefined)
}))

vi.mock("../../src/scenario/loader.js", () => ({
  loadScenarios: vi.fn(),
  loadScenarioSets: vi.fn()
}))

import { runSuite } from "../../src/runner/suite-runner.js"
import { loadScenarios, loadScenarioSets } from "../../src/scenario/loader.js"
import { main as benchmarkMain } from "../../src/cli/benchmark.js"
import { main as checkScenariosMain } from "../../src/cli/check-scenarios.js"
import { ROADMAP_CAPABILITIES_BY_SET } from "../../src/cli/check-scenarios.js"

describe("benchmark cli mains", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("parses args and delegates benchmark main", async () => {
    await benchmarkMain(["run", "ghx_router", "2", "--scenario-set", "pr-review-reads"])

    expect(runSuite).toHaveBeenCalledWith({
      mode: "ghx_router",
      repetitions: 2,
      scenarioFilter: null,
      scenarioSet: "pr-review-reads"
    })
  })

  it("validates scenario count in check-scenarios main", async () => {
    const defaultScenarios = [
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
      },
      {
        id: "issue-view-001",
        name: "Issue",
        task: "issue.view",
        input: { owner: "a", name: "b", number: 1 },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      },
      {
        id: "issue-list-open-001",
        name: "Issue list",
        task: "issue.list",
        input: { owner: "a", name: "b" },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      },
      {
        id: "issue-comments-list-001",
        name: "Issue comments",
        task: "issue.comments.list",
        input: { owner: "a", name: "b", number: 1 },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      },
      {
        id: "pr-view-001",
        name: "PR",
        task: "pr.view",
        input: { owner: "a", name: "b", number: 1 },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      },
      {
        id: "pr-list-open-001",
        name: "PR list",
        task: "pr.list",
        input: { owner: "a", name: "b" },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      }
    ]

    const roadmapSets = Object.fromEntries(
      Object.entries(ROADMAP_CAPABILITIES_BY_SET).map(([setName, capabilities], batchIndex) => {
        const ids = capabilities.map((_, capabilityIndex) => `batch-z-${batchIndex}-${capabilityIndex}-001`)
        return [setName, ids]
      })
    ) as Record<string, string[]>

    const roadmapScenarios = Object.entries(ROADMAP_CAPABILITIES_BY_SET).flatMap(([setName, capabilities], batchIndex) =>
      capabilities.map((capability, capabilityIndex) => ({
        id: (roadmapSets[setName] ?? [])[capabilityIndex] ?? `batch-z-${batchIndex}-${capabilityIndex}-001`,
        name: capability,
        task: capability,
        input: { owner: "a", name: "b" },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      }))
    )

    vi.mocked(loadScenarios).mockResolvedValueOnce([...defaultScenarios, ...roadmapScenarios] as never)
    vi.mocked(loadScenarioSets).mockResolvedValueOnce({
      default: [
        "repo-view-001",
        "issue-view-001",
        "issue-list-open-001",
        "issue-comments-list-001",
        "pr-view-001",
        "pr-list-open-001"
      ],
      "pr-operations-all": ["pr-view-001", "pr-list-open-001"],
      "pr-review-reads": [],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": [],
      ...roadmapSets,
      "roadmap-all": Array.from(new Set(Object.values(roadmapSets).flat()))
    })

    await expect(checkScenariosMain("/tmp/test-cwd")).resolves.toBeUndefined()

    vi.mocked(loadScenarios).mockResolvedValueOnce([])
    await expect(checkScenariosMain("/tmp/test-cwd")).rejects.toThrow("No benchmark scenarios found")
  })
})
