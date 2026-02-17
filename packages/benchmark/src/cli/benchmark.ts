import { runSuite } from "../runner/suite-runner.js"
import { parseCliArgs } from "./args.js"
import { runIfDirectEntry } from "./entry.js"

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseCliArgs(argv)
  return runSuite({
    mode: parsed.mode,
    repetitions: parsed.repetitions,
    scenarioFilter: parsed.scenarioFilter,
    scenarioSet: parsed.scenarioSet,
    fixtureManifestPath: parsed.fixtureManifestPath,
    seedIfMissing: parsed.seedIfMissing,
    providerId: parsed.providerId,
    modelId: parsed.modelId,
    outputJsonlPath: parsed.outputJsonlPath,
    skipWarmup: parsed.skipWarmup,
  })
}

runIfDirectEntry(import.meta.url, main)
