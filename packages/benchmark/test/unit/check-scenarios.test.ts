import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { loadScenariosMock, loadScenarioSetsMock } = vi.hoisted(() => ({
  loadScenariosMock: vi.fn(),
  loadScenarioSetsMock: vi.fn(),
}))

vi.mock("../../src/scenario/loader.js", () => ({
  loadScenarios: loadScenariosMock,
  loadScenarioSets: loadScenarioSetsMock,
}))

import { main, ROADMAP_CAPABILITIES_BY_SET } from "../../src/cli/check-scenarios.js"

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
    tags: [],
  }
}

function createValidRoadmapFixture() {
  const defaultIds = [
    "repo-view-001",
    "issue-view-001",
    "issue-list-open-001",
    "issue-comments-list-001",
    "pr-view-001",
    "pr-list-open-001",
  ]
  const baseScenarios = [
    createScenario("repo-view-001", "repo.view"),
    createScenario("issue-view-001", "issue.view"),
    createScenario("issue-list-open-001", "issue.list"),
    createScenario("issue-comments-list-001", "issue.comments.list"),
    createScenario("pr-view-001", "pr.view"),
    createScenario("pr-list-open-001", "pr.list"),
  ]

  const roadmapSets = Object.fromEntries(
    Object.entries(ROADMAP_CAPABILITIES_BY_SET).map(([setName, capabilities]) => {
      const ids = capabilities.map(
        (capability, capabilityIndex) => `${setName}-${capabilityIndex + 1}-001`,
      )
      return [setName, ids]
    }),
  ) as Record<string, string[]>

  const roadmapScenarios = Object.entries(ROADMAP_CAPABILITIES_BY_SET).flatMap(
    ([setName, capabilities]) =>
      capabilities.map((capability, capabilityIndex) =>
        createScenario(
          (roadmapSets[setName] ?? [])[capabilityIndex] ?? `${setName}-${capabilityIndex + 1}-001`,
          capability,
        ),
      ),
  )

  return {
    scenarios: [...baseScenarios, ...roadmapScenarios],
    sets: {
      default: defaultIds,
      "pr-operations-all": ["pr-view-001", "pr-list-open-001"],
      "pr-review-reads": [],
      "pr-thread-mutations": [],
      "ci-diagnostics": [],
      "ci-log-analysis": [],
      ...roadmapSets,
      all: Array.from(new Set(Object.values(roadmapSets).flat())),
    } as Record<string, string[]>,
    roadmapCapabilityIds: Object.values(ROADMAP_CAPABILITIES_BY_SET).flat(),
    allScenarioCapabilityIds: Array.from(
      new Set([...baseScenarios, ...roadmapScenarios].map((scenario) => scenario.task)),
    ),
  }
}

async function createBenchmarkRootWithCards(capabilityIds: string[], malformedCard = false) {
  const tempRoot = await mkdtemp(join(tmpdir(), "ghx-benchmark-check-"))
  const benchmarkCwd = join(tempRoot, "packages", "benchmark")
  const cardsDir = join(tempRoot, "packages", "core", "src", "core", "registry", "cards")
  await mkdir(cardsDir, { recursive: true })

  if (malformedCard) {
    await writeFile(join(cardsDir, "malformed.yaml"), "name: missing capability id\n", "utf8")
  }

  await Promise.all(
    capabilityIds.map(async (capabilityId, index) => {
      const content = `capability_id: ${capabilityId}\nversion: 1.0.0\n`
      await writeFile(
        join(cardsDir, `card-${String(index + 1).padStart(3, "0")}.yaml`),
        content,
        "utf8",
      )
    }),
  )

  return {
    benchmarkCwd,
    async cleanup() {
      await rm(tempRoot, { recursive: true, force: true })
    },
  }
}

describe("check-scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("passes for valid scenarios and set mappings", async () => {
    const fixture = createValidRoadmapFixture()
    loadScenariosMock.mockResolvedValue(fixture.scenarios)
    loadScenarioSetsMock.mockResolvedValue(fixture.sets)

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
        tags: [],
      },
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["missing-001"],
      "pr-operations-all": ["repo-view-001"],
      "pr-exec": ["repo-view-001"],
      issues: ["repo-view-001"],
      "release-delivery": ["repo-view-001"],
      workflows: ["repo-view-001"],
      "projects-v2": ["repo-view-001"],
      all: ["repo-view-001"],
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
        tags: [],
      },
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: [],
      "pr-operations-all": [],
      "pr-exec": [],
      issues: [],
      "release-delivery": [],
      workflows: [],
      "projects-v2": [],
      all: [],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("orphan scenario")
  })

  it("fails when no scenarios are loaded", async () => {
    loadScenariosMock.mockResolvedValue([])
    loadScenarioSetsMock.mockResolvedValue({
      default: [],
      "pr-operations-all": [],
      "pr-exec": [],
      issues: [],
      "release-delivery": [],
      workflows: [],
      "projects-v2": [],
      all: [],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("No benchmark scenarios found")
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
        tags: [],
      },
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001"],
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
        tags: [],
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
        tags: [],
      },
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001"],
      "pr-exec": ["repo-view-001"],
      issues: ["repo-view-001"],
      "release-delivery": ["repo-view-001"],
      workflows: ["repo-view-001"],
      "projects-v2": ["repo-view-001"],
      all: ["repo-view-001"],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("Duplicate scenario id")
  })

  it("fails when all is not exact union of roadmap batch sets", async () => {
    loadScenariosMock.mockResolvedValue([
      createScenario("repo-view-001", "repo.view"),
      createScenario("pr-review-submit-approve-001", "pr.review.submit_approve"),
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001"],
      "pr-exec": ["pr-review-submit-approve-001"],
      issues: [],
      "release-delivery": [],
      workflows: [],
      "projects-v2": [],
      all: [],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("exact union")
  })

  it("fails when roadmap set coverage is missing required capabilities", async () => {
    loadScenariosMock.mockResolvedValue([createScenario("repo-view-001", "repo.view")])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["repo-view-001"],
      "pr-operations-all": ["repo-view-001"],
      "pr-exec": [],
      issues: [],
      "release-delivery": [],
      workflows: [],
      "projects-v2": [],
      all: [],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow("missing capability coverage")
  })

  it("validates registry capability coverage when cards directory exists", async () => {
    const fixture = createValidRoadmapFixture()
    const temp = await createBenchmarkRootWithCards(fixture.allScenarioCapabilityIds)

    try {
      loadScenariosMock.mockResolvedValue(fixture.scenarios)
      loadScenarioSetsMock.mockResolvedValue(fixture.sets)

      await expect(main(temp.benchmarkCwd)).resolves.toBeUndefined()
    } finally {
      await temp.cleanup()
    }
  })

  it("fails when a registry card cannot be parsed for capability_id", async () => {
    const fixture = createValidRoadmapFixture()
    const temp = await createBenchmarkRootWithCards([], true)

    try {
      loadScenariosMock.mockResolvedValue(fixture.scenarios)
      loadScenarioSetsMock.mockResolvedValue(fixture.sets)

      await expect(main(temp.benchmarkCwd)).rejects.toThrow("Unable to parse capability_id")
    } finally {
      await temp.cleanup()
    }
  })

  it("fails when capability registry contains capabilities with no benchmark coverage", async () => {
    const fixture = createValidRoadmapFixture()
    const temp = await createBenchmarkRootWithCards([
      ...fixture.allScenarioCapabilityIds,
      "nonexistent.capability",
    ])

    try {
      loadScenariosMock.mockResolvedValue(fixture.scenarios)
      loadScenarioSetsMock.mockResolvedValue(fixture.sets)

      await expect(main(temp.benchmarkCwd)).rejects.toThrow(
        "Missing benchmark coverage for capabilities",
      )
    } finally {
      await temp.cleanup()
    }
  })

  it("fails when scenario tasks are not present in capability registry cards", async () => {
    const fixture = createValidRoadmapFixture()
    const reducedCapabilities = fixture.roadmapCapabilityIds.slice(0, -1)
    const temp = await createBenchmarkRootWithCards(reducedCapabilities)

    try {
      loadScenariosMock.mockResolvedValue(fixture.scenarios)
      loadScenarioSetsMock.mockResolvedValue(fixture.sets)

      await expect(main(temp.benchmarkCwd)).rejects.toThrow(
        "Scenario tasks not present in capability registry",
      )
    } finally {
      await temp.cleanup()
    }
  })

  it("fails when capability registry cards define duplicate capability_id values", async () => {
    const fixture = createValidRoadmapFixture()
    const duplicateCapabilities = [
      ...fixture.allScenarioCapabilityIds,
      fixture.allScenarioCapabilityIds[0] ?? "repo.view",
    ]
    const temp = await createBenchmarkRootWithCards(duplicateCapabilities)

    try {
      loadScenariosMock.mockResolvedValue(fixture.scenarios)
      loadScenarioSetsMock.mockResolvedValue(fixture.sets)

      await expect(main(temp.benchmarkCwd)).rejects.toThrow("Duplicate capability_id entries")
    } finally {
      await temp.cleanup()
    }
  })

  it("fails when expected_error outcome has no expected_error_code", async () => {
    const fixture = createValidRoadmapFixture()
    const expectedErrorScenario = {
      ...createScenario("expected-error-001", "repo.view"),
      assertions: { must_succeed: false },
    }

    loadScenariosMock.mockResolvedValue([...fixture.scenarios, expectedErrorScenario])
    loadScenarioSetsMock.mockResolvedValue({
      ...fixture.sets,
      default: [...(fixture.sets.default ?? []), "expected-error-001"],
    })

    await expect(main("/tmp/benchmark")).rejects.toThrow(
      "uses expected_outcome=expected_error but has no expected_error_code",
    )
  })

  it("fails when roadmap sets contain non-success expected outcomes", async () => {
    const fixture = createValidRoadmapFixture()
    const prExecId = fixture.sets["pr-exec"]?.[0] ?? "pr-exec-1-001"
    const nonSuccessScenario = {
      ...createScenario(prExecId, "pr.review.submit_approve"),
      assertions: {
        must_succeed: false,
        expected_outcome: "expected_error",
        expected_error_code: "SIMULATED_ERROR",
      },
    }

    loadScenariosMock.mockResolvedValue(
      fixture.scenarios.map((scenario) =>
        scenario.id === prExecId ? nonSuccessScenario : scenario,
      ),
    )
    loadScenarioSetsMock.mockResolvedValue(fixture.sets)

    await expect(main("/tmp/benchmark")).rejects.toThrow("contains non-success expected outcomes")
  })
})
