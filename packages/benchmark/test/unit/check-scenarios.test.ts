import { beforeEach, describe, expect, it, vi } from "vitest"

const { loadScenariosMock, loadScenarioSetsMock } = vi.hoisted(() => ({
  loadScenariosMock: vi.fn(),
  loadScenarioSetsMock: vi.fn()
}))

vi.mock("../../src/scenario/loader.js", () => ({
  loadScenarios: loadScenariosMock,
  loadScenarioSets: loadScenarioSetsMock
}))

import { main } from "../../src/cli/check-scenarios.js"
import { ROADMAP_CAPABILITIES_BY_SET } from "../../src/cli/check-scenarios.js"

function createScenario(id: string, task: string) {
  return {
    id,
    name: id,
    task,
    input: { owner: "a", name: "b" },
    prompt_template: "x",
    timeout_ms: 1000,
    allowed_retries: 0,
    assertions: { must_succeed: true },
    tags: []
  }
}

describe("check-scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("passes for valid scenarios and set mappings", async () => {
    const defaultIds = [
      "repo-view-001",
      "issue-view-001",
      "issue-list-open-001",
      "issue-comments-list-001",
      "pr-view-001",
      "pr-list-open-001"
    ]
    const baseScenarios = [
      createScenario("repo-view-001", "repo.view"),
      createScenario("issue-view-001", "issue.view"),
      createScenario("issue-list-open-001", "issue.list"),
      createScenario("issue-comments-list-001", "issue.comments.list"),
      createScenario("pr-view-001", "pr.view"),
      createScenario("pr-list-open-001", "pr.list")
    ]

    const roadmapSets = Object.fromEntries(
      Object.entries(ROADMAP_CAPABILITIES_BY_SET).map(([setName, capabilities], batchIndex) => {
        const ids = capabilities.map((capability, capabilityIndex) => `batch-${batchIndex}-${capabilityIndex}-001`)
        return [setName, ids]
      })
    ) as Record<string, string[]>

    const roadmapScenarios = Object.entries(ROADMAP_CAPABILITIES_BY_SET).flatMap(([setName, capabilities], batchIndex) =>
      capabilities.map((capability, capabilityIndex) => createScenario((roadmapSets[setName] ?? [])[capabilityIndex] ?? `batch-${batchIndex}-${capabilityIndex}-001`, capability))
    )

    const roadmapAll = Array.from(new Set(Object.values(roadmapSets).flat()))

    loadScenariosMock.mockResolvedValue([...baseScenarios, ...roadmapScenarios])
    loadScenarioSetsMock.mockResolvedValue({
      default: defaultIds,
      "pr-operations-all": ["pr-view-001", "pr-list-open-001"],
      "pr-review-reads": [],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": [],
      ...roadmapSets,
      "roadmap-all": roadmapAll
    })

    await expect(main("/tmp/benchmark")).resolves.toBeUndefined()
  })

  it("fails when scenario set references unknown scenario id", async () => {
    loadScenariosMock.mockResolvedValue([
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
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["missing-001"],
      "pr-operations-all": ["repo-view-001"],
      "roadmap-batch-a-pr-exec": ["repo-view-001"],
      "roadmap-batch-b-issues": ["repo-view-001"],
      "roadmap-batch-c-release-delivery": ["repo-view-001"],
      "roadmap-batch-d-workflow-projects-v2": ["repo-view-001"],
      "roadmap-all": ["repo-view-001"]
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("unknown scenario id")
  })

  it("fails when scenario is orphaned from all sets", async () => {
    loadScenariosMock.mockResolvedValue([
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
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: [],
      "pr-operations-all": [],
      "roadmap-batch-a-pr-exec": [],
      "roadmap-batch-b-issues": [],
      "roadmap-batch-c-release-delivery": [],
      "roadmap-batch-d-workflow-projects-v2": [],
      "roadmap-all": []
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("orphan scenario")
  })

  it("fails when required sets are missing", async () => {
    loadScenariosMock.mockResolvedValue([
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
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001"]
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("Missing required scenario set")
  })

  it("fails when scenario ids are duplicated", async () => {
    loadScenariosMock.mockResolvedValue([
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
        id: "repo-view-001",
        name: "Repo duplicate",
        task: "repo.view",
        input: { owner: "a", name: "b" },
        prompt_template: "x",
        timeout_ms: 1000,
        allowed_retries: 0,
        assertions: { must_succeed: true },
        tags: []
      }
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001"],
      "roadmap-batch-a-pr-exec": ["repo-view-001"],
      "roadmap-batch-b-issues": ["repo-view-001"],
      "roadmap-batch-c-release-delivery": ["repo-view-001"],
      "roadmap-batch-d-workflow-projects-v2": ["repo-view-001"],
      "roadmap-all": ["repo-view-001"]
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("Duplicate scenario id")
  })

  it("fails when roadmap-all is not exact union of roadmap batch sets", async () => {
    loadScenariosMock.mockResolvedValue([
      createScenario("repo-view-001", "repo.view"),
      createScenario("batch-a-pr-review-submit-approve-001", "pr.review.submit_approve")
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001"],
      "roadmap-batch-a-pr-exec": ["batch-a-pr-review-submit-approve-001"],
      "roadmap-batch-b-issues": [],
      "roadmap-batch-c-release-delivery": [],
      "roadmap-batch-d-workflow-projects-v2": [],
      "roadmap-all": []
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("exact union")
  })
})
