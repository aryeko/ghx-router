import { readFile } from "node:fs/promises"
import type { BenchmarkMode, BenchmarkSummary, HistoryEntry } from "../domain/types.js"
import { parseJsonlLines } from "../utils/jsonl.js"

export type RegressionWarning = {
  metric: string
  mode: BenchmarkMode
  current: number
  recentAverage: number
  thresholdPct: number
  deltaPct: number
}

/**
 * Loads historical benchmark entries from a JSONL file.
 */
export async function loadHistory(path: string): Promise<HistoryEntry[]> {
  try {
    const content = await readFile(path, "utf8")
    const entries = parseJsonlLines<HistoryEntry>(content)
    return entries
  } catch {
    return []
  }
}

/**
 * Detects regressions by comparing current summary against recent history.
 * Flags if:
 * - Median latency increased >15% vs recent average
 * - Success rate dropped >5% vs recent average
 */
export function detectRegressions(
  current: BenchmarkSummary,
  history: HistoryEntry[],
  recentCount: number = 5,
): RegressionWarning[] {
  const warnings: RegressionWarning[] = []

  if (history.length === 0) {
    return warnings
  }

  const recentEntries = history.slice(-recentCount)

  for (const mode of ["agent_direct", "mcp", "ghx"] as const) {
    const currentModeData = current.modes[mode]
    if (!currentModeData) {
      continue
    }

    const recentModeData = recentEntries
      .map((entry) => entry.modes[mode])
      .filter((m): m is typeof currentModeData => m !== undefined)

    if (recentModeData.length === 0) {
      continue
    }

    const avgLatency =
      recentModeData.reduce((sum, m) => sum + m.medianLatencyMs, 0) / recentModeData.length
    const latencyDeltaPct = ((currentModeData.medianLatencyMs - avgLatency) / avgLatency) * 100
    const latencyThresholdPct = 15

    if (latencyDeltaPct > latencyThresholdPct) {
      warnings.push({
        metric: "median_latency_ms",
        mode,
        current: currentModeData.medianLatencyMs,
        recentAverage: avgLatency,
        thresholdPct: latencyThresholdPct,
        deltaPct: latencyDeltaPct,
      })
    }

    const avgSuccessRate =
      recentModeData.reduce((sum, m) => sum + m.successRate, 0) / recentModeData.length
    const successRateDeltaPct = currentModeData.successRate - avgSuccessRate
    const successRateThresholdPct = -5

    if (successRateDeltaPct < successRateThresholdPct) {
      warnings.push({
        metric: "success_rate_pct",
        mode,
        current: currentModeData.successRate,
        recentAverage: avgSuccessRate,
        thresholdPct: successRateThresholdPct,
        deltaPct: successRateDeltaPct,
      })
    }
  }

  return warnings
}

/**
 * Formats regression warnings as markdown.
 */
export function formatRegressionWarnings(warnings: RegressionWarning[]): string {
  if (warnings.length === 0) {
    return ""
  }

  const lines: string[] = []
  lines.push("## Regression Warnings")
  lines.push("")

  for (const warning of warnings) {
    lines.push(`### ${warning.metric} (${warning.mode})`)
    lines.push(
      `- Current: ${warning.current.toFixed(2)}, Recent Avg: ${warning.recentAverage.toFixed(2)}`,
    )
    lines.push(
      `- Change: ${warning.deltaPct.toFixed(2)}% (threshold: ${warning.thresholdPct.toFixed(2)}%)`,
    )
    lines.push("")
  }

  return lines.join("\n")
}
