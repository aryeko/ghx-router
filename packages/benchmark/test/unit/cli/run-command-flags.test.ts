import { beforeEach, describe, expect, it, vi } from "vitest"
import { makeMockScenario } from "../../helpers/scenario-factory.js"

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

const mockScenario = makeMockScenario

describe("run-command flag parsing", () => {
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

  it("parses mode and repetitions from positional args", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["ghx", "1"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modes: ["ghx"],
        repetitions: 1,
      }),
    )
  })

  it("supports agent_direct mode", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["agent_direct", "2"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modes: ["agent_direct"],
        repetitions: 2,
      }),
    )
  })

  it("supports mcp mode", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["mcp", "1"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modes: ["mcp"],
      }),
    )
  })

  it("throws error for unsupported mode", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await expect(main(["bad_mode"])).rejects.toThrow("Unsupported mode")
  })

  it("throws error for invalid repetitions (float)", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await expect(main(["ghx", "1.5"])).rejects.toThrow("Invalid repetitions")
  })

  it("throws error for invalid repetitions (zero)", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await expect(main(["ghx", "0"])).rejects.toThrow("Invalid repetitions")
  })

  it("throws error when --scenario and --scenario-set conflict", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await expect(
      main(["ghx", "1", "--scenario", "s1", "--scenario-set", "default"]),
    ).rejects.toThrow("--scenario and --scenario-set cannot be used together")
  })

  it("filters scenarios by --scenario flag", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1"), mockScenario("s2")])

    await main(["ghx", "1", "--scenario", "s1"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarios: expect.arrayContaining([expect.objectContaining({ id: "s1" })]),
      }),
    )
  })

  it("filters by multiple --scenario flags", async () => {
    loadScenariosMock.mockResolvedValue([
      mockScenario("s1"),
      mockScenario("s2"),
      mockScenario("s3"),
    ])

    await main(["ghx", "1", "--scenario", "s1", "--scenario", "s2"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarios: expect.arrayContaining([
          expect.objectContaining({ id: "s1" }),
          expect.objectContaining({ id: "s2" }),
        ]),
      }),
    )
  })

  it("throws error for unknown scenario in filter", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await expect(main(["ghx", "1", "--scenario", "unknown"])).rejects.toThrow(
      "No scenarios matched filter",
    )
  })

  it("loads scenario set by name", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["ghx", "1", "--scenario-set", "workflows"])

    expect(loadScenarioSetsMock).toHaveBeenCalled()
    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scenarioSet: "workflows",
      }),
    )
  })

  it("throws error for unknown scenario set", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    loadScenarioSetsMock.mockResolvedValue({ default: ["s1"] })

    await expect(main(["ghx", "1", "--scenario-set", "unknown"])).rejects.toThrow(
      "Unknown scenario set",
    )
  })

  it("respects --skip-warmup flag", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["ghx", "1", "--skip-warmup"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skipWarmup: true,
      }),
    )
  })

  it("passes --output-jsonl path to runSuite", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["ghx", "1", "--output-jsonl=/tmp/results.jsonl"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outputJsonlPath: "/tmp/results.jsonl",
      }),
    )
  })

  it("respects --provider flag", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["ghx", "1", "--provider=anthropic"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerConfig: expect.objectContaining({
          providerId: "anthropic",
        }),
      }),
    )
  })

  it("respects --model flag", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["ghx", "1", "--model=claude-opus"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerConfig: expect.objectContaining({
          modelId: "claude-opus",
        }),
      }),
    )
  })

  it("supports --fixture-manifest flag", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    accessMock.mockResolvedValue(undefined)
    loadFixtureManifestMock.mockResolvedValue({
      version: 1,
      repo: { owner: "o", name: "n", full_name: "o/n", default_branch: "main" },
      resources: {},
    })

    await main(["ghx", "1", "--fixture-manifest=/custom/path.json"])

    expect(loadFixtureManifestMock).toHaveBeenCalledWith("/custom/path.json")
  })

  it("throws error when --seed-if-missing without --fixture-manifest", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await expect(main(["ghx", "1", "--seed-if-missing"])).rejects.toThrow(
      "--seed-if-missing requires --fixture-manifest",
    )
  })

  it("throws error when fixture manifest file not found", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    accessMock.mockRejectedValue(new Error("Not found"))

    await expect(main(["ghx", "1", "--fixture-manifest=/missing/path.json"])).rejects.toThrow(
      "Fixture manifest not found",
    )
  })

  it("passes benchLogsDir from BENCH_LOGS_DIR env var to runSuite", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    const originalBenchLogsDir = process.env.BENCH_LOGS_DIR
    process.env.BENCH_LOGS_DIR = "/custom/bench/logs"

    try {
      await main(["ghx", "1"])

      expect(runSuiteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          benchLogsDir: "/custom/bench/logs",
        }),
      )
    } finally {
      if (originalBenchLogsDir === undefined) {
        delete process.env.BENCH_LOGS_DIR
      } else {
        process.env.BENCH_LOGS_DIR = originalBenchLogsDir
      }
    }
  })

  it("passes benchLogsDir=null when BENCH_LOGS_DIR is not set", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    const originalBenchLogsDir = process.env.BENCH_LOGS_DIR
    delete process.env.BENCH_LOGS_DIR

    try {
      await main(["ghx", "1"])

      expect(runSuiteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          benchLogsDir: null,
        }),
      )
    } finally {
      if (originalBenchLogsDir !== undefined) {
        process.env.BENCH_LOGS_DIR = originalBenchLogsDir
      }
    }
  })

  it("passes benchRunTs as a sanitized ISO string to runSuite", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    await main(["ghx", "1"])

    expect(runSuiteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        benchRunTs: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/),
      }),
    )
  })
})
