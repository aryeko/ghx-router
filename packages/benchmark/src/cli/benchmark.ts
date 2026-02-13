import { parseCliArgs } from "./args.js"
import { runSuite } from "../runner/suite-runner.js"

async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2))
  await runSuite({
    mode: parsed.mode,
    repetitions: parsed.repetitions,
    scenarioFilter: parsed.scenarioFilter
  })
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exit(1)
})
