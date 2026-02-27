import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ProfileRow } from "@profiler/types/profile-row.js"
import type { SessionAnalysisBundle } from "@profiler/types/trace.js"
import { generateAnalysisPage } from "./analysis-page.js"
import { generateComparisonPage } from "./comparison-page.js"
import { exportCsv } from "./csv-exporter.js"
import { exportResultsJson, exportSummaryJson } from "./json-exporter.js"
import { generateMetricsPage } from "./metrics-page.js"
import { generateScenarioPage } from "./scenario-page.js"
import { generateSummaryPage } from "./summary-page.js"

/** Options for generating a full profiler report from completed run data. */
export interface ReportOptions {
  /** Unique identifier of the profiling run being reported. */
  readonly runId: string
  /** All profile rows collected during the run. */
  readonly rows: readonly ProfileRow[]
  /** Absolute path to the directory where report files will be written. */
  readonly reportsDir: string
  /** Optional analysis bundles to include in the analysis page. */
  readonly analysisResults?: readonly SessionAnalysisBundle[]
}

/**
 * Generate a complete multi-page Markdown report and data exports for a profiling run.
 *
 * Creates a timestamped subdirectory under `options.reportsDir` containing:
 * - `index.md` — summary page
 * - `metrics.md` — per-metric statistics
 * - `analysis.md` — analyzer findings
 * - `comparison.md` — cross-mode comparison tables
 * - `scenarios/<id>.md` — per-scenario detail pages
 * - `data/results.csv` — raw CSV export
 * - `data/results.json` — raw JSON export
 * - `data/summary.json` — aggregated summary JSON
 *
 * @param options - Report configuration including run ID, rows, and output paths.
 * @returns The absolute path to the generated report directory.
 */
export async function generateReport(options: ReportOptions): Promise<string> {
  const { runId, rows, reportsDir, analysisResults } = options
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const reportDir = join(reportsDir, timestamp)
  const scenariosDir = join(reportDir, "scenarios")
  const dataDir = join(reportDir, "data")

  await mkdir(scenariosDir, { recursive: true })
  await mkdir(dataDir, { recursive: true })

  const scenarioIds = [...new Set(rows.map((r) => r.scenarioId))]

  await Promise.all([
    writeFile(join(reportDir, "index.md"), generateSummaryPage(rows, runId), "utf-8"),
    writeFile(join(reportDir, "metrics.md"), generateMetricsPage(rows), "utf-8"),
    writeFile(
      join(reportDir, "analysis.md"),
      generateAnalysisPage(rows, analysisResults ?? []),
      "utf-8",
    ),
    writeFile(join(reportDir, "comparison.md"), generateComparisonPage(rows), "utf-8"),
    ...scenarioIds.map((id) =>
      writeFile(
        join(scenariosDir, `${id}.md`),
        generateScenarioPage(
          rows.filter((r) => r.scenarioId === id),
          id,
        ),
        "utf-8",
      ),
    ),
    writeFile(join(dataDir, "results.csv"), exportCsv(rows), "utf-8"),
    writeFile(join(dataDir, "results.json"), exportResultsJson(rows), "utf-8"),
    writeFile(join(dataDir, "summary.json"), exportSummaryJson(rows, runId), "utf-8"),
  ])

  return reportDir
}
