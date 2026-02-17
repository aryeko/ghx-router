import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../src/runner/suite-runner.js", () => ({
  runSuite: vi.fn(async () => undefined),
}))

vi.mock("../../src/scenario/loader.js", () => ({
  loadScenarios: vi.fn(),
  loadScenarioSets: vi.fn(),
}))

import { main as benchmarkMain } from "../../src/cli/benchmark.js"
import {
  main as checkScenariosMain,
  ROADMAP_CAPABILITIES_BY_SET,
} from "../../src/cli/check-scenarios.js"
import { runSuite } from "../../src/runner/suite-runner.js"
import { loadScenarioSets, loadScenarios } from "../../src/scenario/loader.js"

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
        tags: [],
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
        tags: [],
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
        tags: [],
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
        tags: [],
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
        tags: [],
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
        tags: [],
      },
    ]

    const roadmapSets = Object.fromEntries(
      Object.entries(ROADMAP_CAPABILITIES_BY_SET).map(([setName, capabilities], batchIndex) => {
        const ids = capabilities.map(
          (_, capabilityIndex) => `batch-z-${batchIndex}-${capabilityIndex}-001`,
        )
        return [setName, ids]
      }),
    ) as Record<string, string[]>

    const roadmapScenarios = Object.entries(ROADMAP_CAPABILITIES_BY_SET).flatMap(
      ([setName, capabilities], batchIndex) =>
        capabilities.map((capability, capabilityIndex) => ({
          id:
            (roadmapSets[setName] ?? [])[capabilityIndex] ??
            `batch-z-${batchIndex}-${capabilityIndex}-001`,
          name: capability,
          task: capability,
          input: { owner: "a", name: "b" },
          prompt_template: "x",
          timeout_ms: 1000,
          allowed_retries: 0,
          assertions: { must_succeed: true },
          tags: [],
        })),
    )

    vi.mocked(loadScenarios).mockResolvedValueOnce([
      ...defaultScenarios,
      ...roadmapScenarios,
    ] as never)
    vi.mocked(loadScenarioSets).mockResolvedValueOnce({
      default: [
        "repo-view-001",
        "issue-view-001",
        "issue-list-open-001",
        "issue-comments-list-001",
        "pr-view-001",
        "pr-list-open-001",
      ],
      "pr-operations-all": ["pr-view-001", "pr-list-open-001"],
      "pr-review-reads": [],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": [],
      ...roadmapSets,
      all: Array.from(new Set(Object.values(roadmapSets).flat())),
    })

    await expect(checkScenariosMain("/tmp/test-cwd")).resolves.toBeUndefined()

    vi.mocked(loadScenarios).mockResolvedValueOnce([])
    await expect(checkScenariosMain("/tmp/test-cwd")).rejects.toThrow(
      "No benchmark scenarios found",
    )
  })
})
