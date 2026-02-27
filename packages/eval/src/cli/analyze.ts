import { parseFlag } from "./parse-flags.js"

export async function analyze(argv: readonly string[]): Promise<void> {
  // TODO: Wire to agent-profiler analyze pipeline when available
  const runDir = parseFlag(argv, "--run-dir") ?? "results"
  console.log(`eval analyze: run-dir=${runDir} (not yet implemented — agent-profiler pending)`)
}
