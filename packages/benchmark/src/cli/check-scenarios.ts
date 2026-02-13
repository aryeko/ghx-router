import { resolve } from "node:path"

import { loadScenarios } from "../scenario/loader.js"

async function main(): Promise<void> {
  const scenariosDir = resolve(process.cwd(), "scenarios")
  const scenarios = await loadScenarios(scenariosDir)

  if (scenarios.length === 0) {
    throw new Error("No benchmark scenarios found")
  }

  console.log(`Validated ${scenarios.length} benchmark scenarios`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
