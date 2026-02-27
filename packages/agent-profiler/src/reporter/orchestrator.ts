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
  /** Optional logger for non-fatal page generation warnings. */
  readonly logger?: { warn: (msg: string) => void }
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
async function safeWrite(
  path: string,
  generate: () => string,
  logger?: { warn: (msg: string) => void },
): Promise<void> {
  try {
    await writeFile(path, generate(), "utf-8")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger?.warn(`Failed to generate report page ${path}: ${message}`)
  }
}

export async function generateReport(options: ReportOptions): Promise<string> {
  const { runId, rows, reportsDir, analysisResults, logger } = options
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const reportDir = join(reportsDir, timestamp)
  const scenariosDir = join(reportDir, "scenarios")
  const dataDir = join(reportDir, "data")

  await mkdir(scenariosDir, { recursive: true })
  await mkdir(dataDir, { recursive: true })

  const scenarioIds = [...new Set(rows.map((r) => r.scenarioId))]

  await Promise.all([
    safeWrite(join(reportDir, "index.md"), () => generateSummaryPage(rows, runId), logger),
    safeWrite(join(reportDir, "metrics.md"), () => generateMetricsPage(rows), logger),
    safeWrite(
      join(reportDir, "analysis.md"),
      () => generateAnalysisPage(rows, analysisResults ?? []),
      logger,
    ),
    safeWrite(join(reportDir, "comparison.md"), () => generateComparisonPage(rows), logger),
    ...scenarioIds.map((id) =>
      safeWrite(
        join(scenariosDir, `${id}.md`),
        () =>
          generateScenarioPage(
            rows.filter((r) => r.scenarioId === id),
            id,
          ),
        logger,
      ),
    ),
    safeWrite(join(dataDir, "results.csv"), () => exportCsv(rows), logger),
    safeWrite(join(dataDir, "results.json"), () => exportResultsJson(rows), logger),
    safeWrite(join(dataDir, "summary.json"), () => exportSummaryJson(rows, runId), logger),
  ])

  return reportDir
}
