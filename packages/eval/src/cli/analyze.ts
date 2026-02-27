import { join } from "node:path"
import { runAnalyzers } from "@eval/analysis/run-analyzers.js"
import { parseFlag } from "./parse-flags.js"

export async function analyze(argv: readonly string[]): Promise<void> {
  const runDir = parseFlag(argv, "--run-dir") ?? "results"
  const outputDir = parseFlag(argv, "--output") ?? join(runDir, "analysis")

  console.log(`Analyzing session traces in ${runDir}/sessions/...`)

  const bundles = await runAnalyzers({ runDir, outputDir })

  console.log(`Analysis complete: ${bundles.length} session(s) analyzed`)
  console.log(`Results written to ${outputDir}/`)
}
