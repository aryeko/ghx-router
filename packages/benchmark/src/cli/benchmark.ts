import { parseCliArgs } from "./args.js"
import { runSuite } from "../runner/suite-runner.js"
import { pathToFileURL } from "node:url"

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseCliArgs(argv)
  return runSuite({
    mode: parsed.mode,
    repetitions: parsed.repetitions,
    scenarioFilter: parsed.scenarioFilter
  })
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  })
}
