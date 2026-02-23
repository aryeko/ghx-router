import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest"
import { makeMockScenario } from "../../helpers/scenario-factory.js"

const loadScenariosMock = vi.hoisted(() => vi.fn())
const loadScenarioSetsMock = vi.hoisted(() => vi.fn())

vi.mock("@bench/scenario/loader.js", () => ({
  loadScenarios: loadScenariosMock,
  loadScenarioSets: loadScenarioSetsMock,
}))

const mockScenario = makeMockScenario

describe("check-command", () => {
  let consoleLogSpy: MockInstance

  beforeEach(() => {
    vi.clearAllMocks()
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})

    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s1"],
      all: ["s1"],
      "full-seeded": ["s1"],
    })
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
  })

  it("validates scenarios and scenario sets successfully", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])

    const { main } = await import("@bench/cli/check-command.js")
    await main()

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Validated"))
  })

  it("throws error for duplicate scenario IDs", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1"), mockScenario("s1")])

    vi.resetModules()
    const { main } = await import("@bench/cli/check-command.js")

    await expect(main()).rejects.toThrow("Duplicate scenario")
  })

  it("throws error for missing required scenario set", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    loadScenarioSetsMock.mockResolvedValue({ default: ["s1"] })

    vi.resetModules()
    const { main } = await import("@bench/cli/check-command.js")

    await expect(main()).rejects.toThrow("Missing required scenario set")
  })

  it("throws error when scenario set references unknown scenario id", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1")])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["unknown"],
      workflows: ["s1"],
      all: ["s1"],
      "full-seeded": ["s1"],
    })

    vi.resetModules()
    const { main } = await import("@bench/cli/check-command.js")

    await expect(main()).rejects.toThrow("references unknown scenario id")
  })

  it("throws error for orphan scenario not in any set", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1"), mockScenario("orphan")])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s1"],
      all: ["s1"],
      "full-seeded": ["s1"],
    })

    vi.resetModules()
    const { main } = await import("@bench/cli/check-command.js")

    await expect(main()).rejects.toThrow("orphan scenario")
  })

  it("throws error when no scenarios found", async () => {
    loadScenariosMock.mockResolvedValue([])

    vi.resetModules()
    const { main } = await import("@bench/cli/check-command.js")

    await expect(main()).rejects.toThrow("No benchmark scenarios found")
  })

  it("logs validation summary with scenario and set counts", async () => {
    loadScenariosMock.mockResolvedValue([mockScenario("s1"), mockScenario("s2")])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s2"],
      all: ["s1", "s2"],
      "full-seeded": ["s1", "s2"],
    })

    vi.resetModules()
    const { main } = await import("@bench/cli/check-command.js")
    await main()

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Validated 2 benchmark scenarios/),
    )
  })

  it("handles complex scenario references across multiple sets", async () => {
    loadScenariosMock.mockResolvedValue([
      mockScenario("s1"),
      mockScenario("s2"),
      mockScenario("s3"),
    ])
    loadScenarioSetsMock.mockResolvedValue({
      default: ["s1"],
      workflows: ["s1", "s2"],
      all: ["s1", "s2", "s3"],
      "full-seeded": ["s1", "s2", "s3"],
    })

    vi.resetModules()
    const { main } = await import("@bench/cli/check-command.js")
    await main()

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Validated"))
  })
})
