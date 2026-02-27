import { rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { loadEvalScenarios, loadScenarioSets } from "@eval/scenario/loader.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const validScenario = {
  id: "pr-fix-mixed-threads-001",
  name: "Fix PR",
  description: "Fix PR with mixed threads",
  prompt: "Review PR",
  timeoutMs: 180000,
  category: "pr",
  difficulty: "intermediate",
  assertions: {
    checkpoints: [],
  },
}

let tmpDir: string

beforeEach(async () => {
  tmpDir = await import("node:os").then((os) =>
    import("node:fs/promises").then((fs) => fs.mkdtemp(join(os.tmpdir(), "eval-test-"))),
  )
})

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

describe("loadEvalScenarios", () => {
  it("loads a valid scenario from directory", async () => {
    await writeFile(join(tmpDir, "pr-fix-mixed-threads-001.json"), JSON.stringify(validScenario))
    const scenarios = await loadEvalScenarios(tmpDir)
    expect(scenarios).toHaveLength(1)
    expect(scenarios[0]?.id).toBe("pr-fix-mixed-threads-001")
  })

  it("filters by requested IDs", async () => {
    await writeFile(join(tmpDir, "pr-fix-mixed-threads-001.json"), JSON.stringify(validScenario))
    await writeFile(
      join(tmpDir, "pr-review-comment-001.json"),
      JSON.stringify({
        ...validScenario,
        id: "pr-review-comment-001",
      }),
    )
    const scenarios = await loadEvalScenarios(tmpDir, ["pr-review-comment-001"])
    expect(scenarios).toHaveLength(1)
    expect(scenarios[0]?.id).toBe("pr-review-comment-001")
  })

  it("throws when requested ID is not found", async () => {
    await writeFile(join(tmpDir, "pr-fix-mixed-threads-001.json"), JSON.stringify(validScenario))
    await expect(loadEvalScenarios(tmpDir, ["nonexistent-001"])).rejects.toThrow(
      "Scenario IDs not found: nonexistent-001",
    )
  })

  it("throws when scenario fails validation", async () => {
    await writeFile(join(tmpDir, "bad-scenario.json"), JSON.stringify({ id: "invalid" }))
    await expect(loadEvalScenarios(tmpDir)).rejects.toThrow("Failed to load scenarios")
  })

  it("skips scenario-sets.json", async () => {
    await writeFile(
      join(tmpDir, "scenario-sets.json"),
      JSON.stringify({ default: ["pr-fix-mixed-threads-001"] }),
    )
    await writeFile(join(tmpDir, "pr-fix-mixed-threads-001.json"), JSON.stringify(validScenario))
    const scenarios = await loadEvalScenarios(tmpDir)
    expect(scenarios).toHaveLength(1)
  })
})

describe("loadScenarioSets", () => {
  it("loads scenario sets from file", async () => {
    await writeFile(
      join(tmpDir, "scenario-sets.json"),
      JSON.stringify({
        default: ["pr-fix-mixed-threads-001"],
        full: ["pr-fix-mixed-threads-001"],
      }),
    )
    const sets = await loadScenarioSets(tmpDir)
    expect(sets["default"]).toEqual(["pr-fix-mixed-threads-001"])
  })

  it("returns empty object when file not found", async () => {
    const sets = await loadScenarioSets(tmpDir)
    expect(sets).toEqual({})
  })

  it("throws when scenario-sets.json has invalid shape", async () => {
    await writeFile(join(tmpDir, "scenario-sets.json"), JSON.stringify({ default: "not-an-array" }))
    await expect(loadScenarioSets(tmpDir)).rejects.toThrow()
  })
})
