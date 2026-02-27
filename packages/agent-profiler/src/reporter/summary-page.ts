import type { ProfileRow } from "@profiler/types/profile-row.js"

export function generateSummaryPage(rows: readonly ProfileRow[], runId: string): string {
  const modes = [...new Set(rows.map((r) => r.mode))]
  const scenarios = [...new Set(rows.map((r) => r.scenarioId))]
  const date = new Date().toISOString()

  const successByMode = modes.map((mode) => {
    const modeRows = rows.filter((r) => r.mode === mode)
    const passed = modeRows.filter((r) => r.success).length
    const total = modeRows.length
    const rate = total === 0 ? 0 : (passed / total) * 100
    return { mode, passed, total, rate }
  })

  const lines: readonly string[] = [
    "# Profile Run Summary",
    "",
    "## Run Configuration",
    "",
    "| Property | Value |",
    "| --- | --- |",
    `| Run ID | ${runId} |`,
    `| Total Rows | ${rows.length} |`,
    `| Modes | ${modes.join(", ")} |`,
    `| Scenarios | ${scenarios.join(", ")} |`,
    `| Date | ${date} |`,
    "",
    "## Success Rate by Mode",
    "",
    "| Mode | Passed | Total | Rate |",
    "| --- | --- | --- | --- |",
    ...successByMode.map((s) => `| ${s.mode} | ${s.passed} | ${s.total} | ${s.rate.toFixed(1)}% |`),
    "",
    "## Navigation",
    "",
    "- [Metrics Detail](./metrics.md)",
    "- [Session Analysis](./analysis.md)",
    "- [Mode Comparison](./comparison.md)",
    "- [Data Exports](./data/)",
  ]

  return lines.join("\n")
}
