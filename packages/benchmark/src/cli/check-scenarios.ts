import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { loadScenarios, loadScenarioSets } from "../scenario/loader.js"

const REQUIRED_SCENARIO_SETS = ["default", "pr-operations-all", "roadmap-batch-a-pr-exec"]

function assertNoDuplicateScenarioIds(scenarioIds: string[]): void {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const scenarioId of scenarioIds) {
    if (seen.has(scenarioId)) {
      duplicates.add(scenarioId)
    }
    seen.add(scenarioId)
  }

  if (duplicates.size > 0) {
    throw new Error(`Duplicate scenario id(s): ${Array.from(duplicates).join(", ")}`)
  }
}

function assertRequiredScenarioSetsExist(scenarioSets: Record<string, string[]>): void {
  for (const setName of REQUIRED_SCENARIO_SETS) {
    if (!Object.hasOwn(scenarioSets, setName)) {
      throw new Error(`Missing required scenario set: ${setName}`)
    }
  }
}

function assertSetReferencesAreKnown(
  scenarioSets: Record<string, string[]>,
  knownScenarioIds: Set<string>
): void {
  for (const [setName, scenarioIds] of Object.entries(scenarioSets)) {
    const unknownScenarioIds = scenarioIds.filter((scenarioId) => !knownScenarioIds.has(scenarioId))
    if (unknownScenarioIds.length > 0) {
      throw new Error(`Scenario set '${setName}' references unknown scenario id(s): ${unknownScenarioIds.join(", ")}`)
    }
  }
}

function assertNoOrphanScenarios(scenarioSets: Record<string, string[]>, scenarioIds: string[]): void {
  const allReferencedIds = new Set(Object.values(scenarioSets).flat())
  const orphanIds = scenarioIds.filter((scenarioId) => !allReferencedIds.has(scenarioId))

  if (orphanIds.length > 0) {
    throw new Error(`Found orphan scenario id(s) not present in any set: ${orphanIds.join(", ")}`)
  }
}

export async function main(cwd: string = process.cwd()): Promise<void> {
  const scenariosDir = resolve(cwd, "scenarios")
  const benchmarkRoot = resolve(cwd)
  const scenarios = await loadScenarios(scenariosDir)
  const scenarioSets = await loadScenarioSets(benchmarkRoot)

  if (scenarios.length === 0) {
    throw new Error("No benchmark scenarios found")
  }

  const scenarioIds = scenarios.map((scenario) => scenario.id)
  const knownScenarioIds = new Set(scenarioIds)

  assertNoDuplicateScenarioIds(scenarioIds)
  assertRequiredScenarioSetsExist(scenarioSets)
  assertSetReferencesAreKnown(scenarioSets, knownScenarioIds)
  assertNoOrphanScenarios(scenarioSets, scenarioIds)

  console.log(`Validated ${scenarios.length} benchmark scenarios across ${Object.keys(scenarioSets).length} sets`)
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
