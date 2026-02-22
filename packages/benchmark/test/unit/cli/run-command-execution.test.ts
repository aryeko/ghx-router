import type { Scenario } from "@bench/domain/types.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

const runSuiteMock = vi.hoisted(() => vi.fn().mockResolvedValue({ rowCount: 1, durationMs: 100 }))
const loadScenariosMock = vi.hoisted(() => vi.fn())
const loadScenarioSetsMock = vi.hoisted(() => vi.fn())
const seedFixtureManifestMock = vi.hoisted(() => vi.fn())
const loadFixtureManifestMock = vi.hoisted(() => vi.fn())
const accessMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/runner/suite.js", () => ({ runSuite: runSuiteMock }))
vi.mock("@bench/scenario/loader.js", () => ({
  loadScenarios: loadScenariosMock,
  loadScenarioSets: loadScenarioSetsMock,
}))
vi.mock("@bench/fixture/seeder.js", () => ({
  seedFixtureManifest: seedFixtureManifestMock,
}))
vi.mock("@bench/fixture/manifest.js", () => ({
  loadFixtureManifest: loadFixtureManifestMock,
}))
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return { ...actual, access: accessMock }
})

import { main } from "@bench/cli/run-command.js"

function mockScenario(id: string): Scenario {
  return {
    type: "workflow",
    id,
    name: `Scenario ${id}`,
    prompt: "Do some work",
    expected_capabilities: [],
    timeout_ms: 60000,
    allowed_retries: 0,
    assertions: {
      expected_outcome: "success",
      checkpoints: [],
    },
    tags: [],
  }
}

describe("run-command execution behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s1"],
      all: ["s1"],
      "full-seeded": ["s1"],
    })
    accessMock.mockRejectedValue(new Error("Not found"))
    seedFixtureManifestMock.mockResolvedValue(undefined)
    loadFixtureManifestMock.mockResolvedValue(null)
  })

  it("throws error when no scenarios found", async () => {
    loadScenariosMock.mockResolvedValue([])

    await expect(main(["ghx", "1"])).rejects.toThrow("No benchmark scenarios found")
  })

  it("throws error when scenario set references unknown scenario id", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    loadScenarioSetsMock.mockResolvedValue({ default: ["unknown"] })

    await expect(main(["ghx", "1"])).rejects.toThrow("references unknown scenario id")
  })

  it("defaults to ghx mode when not specified", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main([])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modes: ["ghx"],
      }),
    )
  })

  it("defaults to 1 repetition when not specified", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main([])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        repetitions: 1,
      }),
    )
  })

  it("passes scenarios to runSuite", async () => {
    const scenarios = [mockScenario("s1")]
    loadScenariosMock.mockResolvedValue(scenarios)

    await main(["ghx", "1"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarios: expect.arrayContaining(scenarios),
      }),
    )
  })

  it("resolves scenario set name", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      custom: ["s1"],
    })

    await main(["ghx", "1", "--scenario-set", "custom"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioSet: "custom",
      }),
    )
  })

  it("sets scenarioSet to null when using --scenario filter", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["ghx", "1", "--scenario", "s1"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioSet: null,
      }),
    )
  })

  it("auto-discovers default fixture manifest when scenarios need bindings", async () => {
    const scenarioWithBindings = mockScenario("s1")
    scenarioWithBindings.fixture = { bindings: { repo: "test" } }
    loadScenariosMock.mockResolvedValue([scenarioWithBindings])
    accessMock.mockResolvedValue(undefined)

    await main(["ghx", "1"])

    expect(loadFixtureManifestMock).toHaveBeenCalledWith("fixtures/latest.json")
  })

  it("seeds fixture manifest when --seed-if-missing provided and manifest missing", async () => {
    const scenarioWithBindings = mockScenario("s1")
    scenarioWithBindings.fixture = { bindings: { repo: "test" }, requires: ["resource1"] }
    loadScenariosMock.mockResolvedValue([scenarioWithBindings])
    loadFixtureManifestMock.mockResolvedValue({
      version: 1,
      repo: { owner: "o", name: "n", full_name: "o/n", default_branch: "main" },
      resources: {},
    })

    await main(["ghx", "1", "--seed-if-missing"])

    expect(seedFixtureManifestMock).toHaveBeenCalled()
  })

  it("throws error when fixture manifest missing and not auto-seeding", async () => {
    const scenarioWithBindings = mockScenario("s1")
    scenarioWithBindings.fixture = { bindings: { repo: "test" } }
    loadScenariosMock.mockResolvedValue([scenarioWithBindings])
    accessMock.mockRejectedValue(new Error("Not found"))

    await expect(main(["ghx", "1"])).rejects.toThrow("Selected scenarios require fixture bindings")
  })
})
