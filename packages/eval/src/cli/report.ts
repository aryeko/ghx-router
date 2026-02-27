import { parseFlag } from "./parse-flags.js"

export async function report(argv: readonly string[]): Promise<void> {
  // TODO: Wire to agent-profiler generateReport() when available
  const runDir = parseFlag(argv, "--run-dir") ?? "results"
  console.log(`eval report: run-dir=${runDir} (not yet implemented — agent-profiler pending)`)
}
