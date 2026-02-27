import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { bindFixtureVariables, type FixtureBindings } from "./fixture-binder.js"
import { type EvalScenario, EvalScenarioSchema } from "./schema.js"

/**
 * Loads and validates eval scenarios from a directory of JSON files.
 *
 * When `ids` is provided, only scenarios with matching IDs are returned.
 * Throws on schema validation failures or duplicate IDs.
 *
 * @param scenariosDir - Directory containing `*.json` scenario files
 * @param ids - Optional: only return scenarios matching these IDs
 * @param manifest - Optional fixture manifest for `{{variable}}` substitution
 * @returns Validated, deduplicated scenario array
 * @throws {Error} On schema validation error or duplicate scenario IDs
 *
 * @example
 * ```typescript
 * import { loadEvalScenarios } from "@ghx-dev/eval"
 *
 * const scenarios = await loadEvalScenarios("scenarios/", ["pr-fix-001"])
 * console.log(scenarios[0].prompt)
 * ```
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
 * Loads the `scenario-sets.json` file mapping set names to scenario ID arrays.
 *
 * Returns an empty object when the file does not exist.
 *
 * @param scenariosDir - Directory containing `scenario-sets.json`
 * @returns Map of set name → scenario IDs
 *
 * @example
 * ```typescript
 * import { loadScenarioSets } from "@ghx-dev/eval"
 *
 * const sets = await loadScenarioSets("scenarios/")
 * console.log(sets["smoke"]) // ["pr-fix-001", "issue-close-001"]
 * ```
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
