import { computeDescriptive } from "@profiler/stats/descriptive.js"
import type { DescriptiveStats } from "@profiler/types/metrics.js"
import type { ProfileRow } from "@profiler/types/profile-row.js"

interface MetricExtractor {
  readonly label: string
  readonly extract: (row: ProfileRow) => number
}

const METRICS: readonly MetricExtractor[] = [
  { label: "Wall Time (ms)", extract: (r) => r.timing.wallMs },
  { label: "Total Tokens", extract: (r) => r.tokens.total },
  { label: "Total Tool Calls", extract: (r) => r.toolCalls.total },
  { label: "Cost (USD)", extract: (r) => r.cost.totalUsd },
]

function formatStatValue(value: number, isCost: boolean): string {
  return isCost ? value.toFixed(4) : value.toFixed(2)
}

function renderStatsTable(
  label: string,
  stats: DescriptiveStats,
  isCost: boolean,
): readonly string[] {
  const fmt = (v: number) => formatStatValue(v, isCost)
  return [
    `### ${label}`,
    "",
    "| Stat | Value |",
    "| --- | --- |",
    `| Count | ${stats.count} |`,
    `| p50 | ${fmt(stats.median)} |`,
    `| p90 | ${fmt(stats.p90)} |`,
    `| p95 | ${fmt(stats.p95)} |`,
    `| Min | ${fmt(stats.min)} |`,
    `| Max | ${fmt(stats.max)} |`,
    `| IQR | ${fmt(stats.iqr)} |`,
    `| CV | ${stats.cv.toFixed(4)} |`,
    "",
  ]
}

export function generateMetricsPage(rows: readonly ProfileRow[]): string {
  const modes = [...new Set(rows.map((r) => r.mode))]

  const sections: string[] = ["# Metrics Detail", ""]

  for (const mode of modes) {
    sections.push(`## Mode: ${mode}`, "")
    const modeRows = rows.filter((r) => r.mode === mode)

    for (const metric of METRICS) {
      const values = modeRows.map(metric.extract)
      const stats = computeDescriptive(values)
      const isCost = metric.label.includes("Cost")
      const tableLines = renderStatsTable(metric.label, stats, isCost)
      sections.push(...tableLines)
    }
  }

  return sections.join("\n")
}
