import type { ProfileRow } from "@profiler/types/profile-row.js"

export function exportResultsJson(rows: readonly ProfileRow[]): string {
  return JSON.stringify(rows, null, 2)
}

export function exportSummaryJson(rows: readonly ProfileRow[], runId: string): string {
  const modes = [...new Set(rows.map((r) => r.mode))]
  const scenarios = [...new Set(rows.map((r) => r.scenarioId))]
  const successCount = rows.filter((r) => r.success).length
  const successRate = rows.length === 0 ? 0 : successCount / rows.length

  const summary = {
    version: 1,
    runId,
    generatedAt: new Date().toISOString(),
    totalRows: rows.length,
    modes,
    scenarios,
    successRate,
  }

  return JSON.stringify(summary, null, 2)
}
