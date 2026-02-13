import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { loadScenarios } from "../scenario/loader.js"

export async function main(cwd: string = process.cwd()): Promise<void> {
  const scenariosDir = resolve(cwd, "scenarios")
  const scenarios = await loadScenarios(scenariosDir)

  if (scenarios.length === 0) {
    throw new Error("No benchmark scenarios found")
  }

  console.log(`Validated ${scenarios.length} benchmark scenarios`)
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
  })
}
