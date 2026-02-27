import { join } from "node:path"

import { generateEvalReport } from "@eval/report/generate.js"

import { parseFlag, parseFlagAll } from "./parse-flags.js"

export async function report(argv: readonly string[]): Promise<void> {
  const runDir = parseFlag(argv, "--run-dir") ?? "results"
  const resultsPaths = parseFlagAll(argv, "--results")
  const format = (parseFlag(argv, "--format") ?? "all") as "all" | "md" | "csv" | "json"
  const outputDir = parseFlag(argv, "--output-dir") ?? join(runDir, "reports")

  // Default results path if none specified
  const paths = resultsPaths.length > 0 ? resultsPaths : [join(runDir, "results.jsonl")]

  console.log(`Generating report from ${paths.join(", ")}...`)

  const reportDir = await generateEvalReport({
    runDir,
    resultsPaths: paths,
    outputDir,
    format,
  })

  console.log(`Report generated at ${reportDir}`)
}
