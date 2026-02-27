import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { bindFixtureVariables, type FixtureBindings } from "./fixture-binder.js"
import { type EvalScenario, EvalScenarioSchema } from "./schema.js"

/**
 * Load and validate scenario JSON files.
 * @param scenariosDir Path to directory containing scenario JSON files
 * @param ids Optional list of scenario IDs to load (loads all if omitted)
 * @param manifest Optional fixture manifest for template variable resolution
 */
export async function loadEvalScenarios(
  scenariosDir: string,
  ids?: readonly string[],
  manifest?: FixtureBindings,
): Promise<readonly EvalScenario[]> {
  const files = await readdir(scenariosDir)
  const jsonFiles = files.filter((f) => f.endsWith(".json") && f !== "scenario-sets.json")

  const scenarios: EvalScenario[] = []
  const errors: string[] = []

  for (const file of jsonFiles) {
    const filePath = join(scenariosDir, file)
    try {
      const content = await readFile(filePath, "utf-8")
      const raw = JSON.parse(content) as unknown
      const scenario = EvalScenarioSchema.parse(raw)

      // Filter by requested IDs if provided
      if (ids !== undefined && !ids.includes(scenario.id)) continue

      const bound = manifest ? bindFixtureVariables(scenario, manifest) : scenario
      scenarios.push(bound)
    } catch (error) {
      errors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Failed to load scenarios:\n${errors.join("\n")}`)
  }

  // Verify all requested IDs were found
  if (ids !== undefined) {
    const found = new Set(scenarios.map((s) => s.id))
    const missing = ids.filter((id) => !found.has(id))
    if (missing.length > 0) {
      throw new Error(`Scenario IDs not found: ${missing.join(", ")}`)
    }
  }

  // Verify no duplicate IDs
  const idCounts = new Map<string, number>()
  for (const s of scenarios) {
    idCounts.set(s.id, (idCounts.get(s.id) ?? 0) + 1)
  }
  const duplicates = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  if (duplicates.length > 0) {
    throw new Error(`Duplicate scenario IDs: ${duplicates.join(", ")}`)
  }

  return scenarios
}

/**
 * Load scenario sets from scenario-sets.json
 */
export async function loadScenarioSets(
  scenariosDir: string,
): Promise<Readonly<Record<string, readonly string[]>>> {
  const filePath = join(scenariosDir, "scenario-sets.json")
  try {
    const content = await readFile(filePath, "utf-8")
    return JSON.parse(content) as Record<string, readonly string[]>
  } catch {
    return {}
  }
}
