import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import type { Scenario } from "../domain/types.js"
import { validateScenario } from "./schema.js"

export async function loadScenarios(scenariosDir: string): Promise<Scenario[]> {
  const files = await readdir(scenariosDir)
  const scenarioFiles = files.filter((file) => file.endsWith(".json"))

  const scenarios = await Promise.all(
    scenarioFiles.map(async (file) => {
      const raw = await readFile(join(scenariosDir, file), "utf8")
      return validateScenario(JSON.parse(raw))
    })
  )

  return scenarios.sort((a, b) => a.id.localeCompare(b.id))
}
