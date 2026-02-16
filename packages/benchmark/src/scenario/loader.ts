import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"

import type { Scenario } from "../domain/types.js"
import { validateScenario } from "./schema.js"

const scenarioSetsSchema = z.record(z.string(), z.array(z.string().min(1)))

export async function loadScenarios(scenariosDir: string): Promise<Scenario[]> {
  const files = await readdir(scenariosDir)
  const scenarioFiles = files.filter((file) => file.endsWith(".json"))

  const scenarios = await Promise.all(
    scenarioFiles.map(async (file) => {
      const raw = await readFile(join(scenariosDir, file), "utf8")
      return validateScenario(JSON.parse(raw))
    }),
  )

  return scenarios.sort((a, b) => a.id.localeCompare(b.id))
}

export async function loadScenarioSets(
  benchmarkRootDir: string,
): Promise<Record<string, string[]>> {
  const raw = await readFile(join(benchmarkRootDir, "scenario-sets.json"), "utf8")
  const parsed = scenarioSetsSchema.safeParse(JSON.parse(raw))
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path[0]
    if (typeof path === "string") {
      throw new Error(
        `Invalid scenario-sets manifest: set '${path}' must be an array of non-empty scenario ids`,
      )
    }

    throw new Error("Invalid scenario-sets manifest: expected object")
  }

  return parsed.data
}
