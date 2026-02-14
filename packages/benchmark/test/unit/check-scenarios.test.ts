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

describe("check-scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("passes for valid scenarios and set mappings", async () => {
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
      "pr-operations-all": ["repo-view-001"],
      "roadmap-batch-a-pr-exec": ["repo-view-001"],
      "pr-review-reads": [],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": []
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
      "roadmap-batch-a-pr-exec": ["repo-view-001"]
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
      "roadmap-batch-a-pr-exec": []
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
      "roadmap-batch-a-pr-exec": ["repo-view-001"]
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("Duplicate scenario id")
  })
})
