import { readdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"

import type { ProfileRow, SessionAnalysisBundle } from "@ghx-dev/agent-profiler"
import { generateReport, readJsonlFile } from "@ghx-dev/agent-profiler"

export interface GenerateReportOptions {
  readonly runDir: string
  readonly resultsPaths: readonly string[]
  readonly outputDir: string
  readonly format: "all" | "md" | "csv" | "json"
}

async function loadAnalysisBundles(runDir: string): Promise<readonly SessionAnalysisBundle[]> {
  const analysisDir = join(runDir, "analysis")
  let scenarioDirs: string[]

  try {
    scenarioDirs = (await readdir(analysisDir)) as unknown as string[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }

  const bundles: SessionAnalysisBundle[] = []

  for (const scenarioId of scenarioDirs) {
    const scenarioDir = join(analysisDir, scenarioId)
    let files: string[]
    try {
      files = ((await readdir(scenarioDir)) as unknown as string[]).filter((f) =>
        f.endsWith("-analysis.json"),
      )
    } catch {
      continue
    }

    for (const file of files) {
      const content = await readFile(join(scenarioDir, file), "utf-8")
      bundles.push(JSON.parse(content) as SessionAnalysisBundle)
    }
  }

  return bundles
}

/**
 * Loads JSONL result rows and optional analysis bundles, then generates
 * a full report via agent-profiler's generateReport().
 */
export async function generateEvalReport(options: GenerateReportOptions): Promise<string> {
  // Load rows from all JSONL paths
  const allRows: ProfileRow[] = []
  for (const path of options.resultsPaths) {
    const rows = await readJsonlFile(path, (line: string) => JSON.parse(line) as ProfileRow)
    allRows.push(...rows)
  }

  if (allRows.length === 0) {
    throw new Error("No profile rows found in the specified results file(s)")
  }

  // Extract runId from first row — safe after length check above
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const runId = allRows[0]!.runId

  // Try to load analysis bundles
  const analysisResults = await loadAnalysisBundles(options.runDir)

  // Generate report (spread analysisResults only when non-empty to
  // satisfy exactOptionalPropertyTypes — the field cannot be undefined)
  const reportDir = await generateReport({
    runId,
    rows: allRows,
    reportsDir: options.outputDir,
    ...(analysisResults.length > 0 ? { analysisResults } : {}),
  })

  // Format filtering: remove unwanted output files
  if (options.format !== "all") {
    if (options.format !== "csv") {
      await rm(join(reportDir, "data", "results.csv"), { force: true })
    }
    if (options.format !== "json") {
      await rm(join(reportDir, "data", "results.json"), { force: true })
      await rm(join(reportDir, "data", "summary.json"), { force: true })
    }
    if (options.format !== "md") {
      for (const mdFile of ["index.md", "metrics.md", "analysis.md", "comparison.md"]) {
        await rm(join(reportDir, mdFile), { force: true })
      }
      await rm(join(reportDir, "scenarios"), { recursive: true, force: true })
    }
  }

  return reportDir
}
