import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { loadScenarioSets, loadScenarios } from "../../../src/scenario/loader.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixturesDir = join(__dirname, "../../fixtures")

describe("scenario/loader", () => {
  describe("loadScenarios", () => {
    it("loads scenarios from directory recursively", async () => {
      const scenariosDir = join(fixturesDir, "scenarios")
      const scenarios = await loadScenarios(scenariosDir)

      expect(scenarios).toBeDefined()
      expect(Array.isArray(scenarios)).toBe(true)
    })

    it("returns sorted scenarios by id", async () => {
      const scenariosDir = join(fixturesDir, "scenarios")
      const scenarios = await loadScenarios(scenariosDir)
      const ids = scenarios.map((s) => s.id)
      const sorted = [...ids].sort()
      expect(ids).toEqual(sorted)
    })

    it("validates scenario structure", async () => {
      const scenariosDir = join(fixturesDir, "scenarios")
      const scenarios = await loadScenarios(scenariosDir)

      expect(scenarios.length).toBeGreaterThan(0)
      const scenario = scenarios[0]
      expect(scenario).toBeDefined()
      expect(scenario?.type).toBe("workflow")
      expect(scenario?.id).toBeDefined()
      expect(scenario?.name).toBeDefined()
      expect(scenario?.prompt).toBeDefined()
      expect(scenario?.expected_capabilities).toBeDefined()
      expect(scenario?.timeout_ms).toBeDefined()
      expect(scenario?.allowed_retries).toBeDefined()
      expect(scenario?.assertions).toBeDefined()
      expect(scenario?.tags).toBeDefined()
    })
  })

  describe("loadScenarioSets", () => {
    it("loads scenario sets from manifest file", async () => {
      const benchmarkRootDir = join(fixturesDir, "benchmark-root")
      const sets = await loadScenarioSets(benchmarkRootDir)

      expect(sets).toBeDefined()
      expect(typeof sets).toBe("object")
    })

    it("returns object with array values", async () => {
      const benchmarkRootDir = join(fixturesDir, "benchmark-root")
      const sets = await loadScenarioSets(benchmarkRootDir)

      for (const [key, value] of Object.entries(sets)) {
        expect(typeof key).toBe("string")
        expect(Array.isArray(value)).toBe(true)
        for (const item of value) {
          expect(typeof item).toBe("string")
          expect(item.length).toBeGreaterThan(0)
        }
      }
    })

    it("throws error on invalid manifest", async () => {
      const benchmarkRootDir = join(fixturesDir, "invalid-benchmark-root")
      await expect(loadScenarioSets(benchmarkRootDir)).rejects.toThrow()
    })
  })
})
