import type { BenchmarkMode, BenchmarkRow } from "../domain/types.js"

type ModeSummary = {
  mode: BenchmarkMode
  runs: number
  successRate: number
  outputValidityRate: number
  medianLatencyMs: number
  medianTokensTotal: number
  medianToolCalls: number
}

type DeltaSummary = {
  tokensReductionPct: number
  latencyReductionPct: number
  toolCallReductionPct: number
  successRateDeltaPct: number
  outputValidityRatePct: number
}

export type GateThresholds = {
  minTokensReductionPct: number
  minLatencyReductionPct: number
  minToolCallReductionPct: number
  maxSuccessRateDropPct: number
  minOutputValidityRatePct: number
}

export type BenchmarkSummary = {
  generatedAt: string
  modes: Partial<Record<BenchmarkMode, ModeSummary>>
  deltaVsAgentDirect: DeltaSummary | null
  gate: {
    passed: boolean
    checks: Array<{ name: string; passed: boolean; value: number; threshold: number }>
  }
}

const DEFAULT_THRESHOLDS: GateThresholds = {
  minTokensReductionPct: 25,
  minLatencyReductionPct: 20,
  minToolCallReductionPct: 30,
  maxSuccessRateDropPct: 1,
  minOutputValidityRatePct: 99
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1] ?? 0
    const right = sorted[middle] ?? 0
    return (left + right) / 2
  }
  return sorted[middle] ?? 0
}

function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return (numerator / denominator) * 100
}

function safeReductionPct(baseline: number, target: number): number {
  if (baseline <= 0) return 0
  return ((baseline - target) / baseline) * 100
}

function summarizeMode(mode: BenchmarkMode, rows: BenchmarkRow[]): ModeSummary {
  return {
    mode,
    runs: rows.length,
    successRate: pct(rows.filter((row) => row.success).length, rows.length),
    outputValidityRate: pct(rows.filter((row) => row.output_valid).length, rows.length),
    medianLatencyMs: median(rows.map((row) => row.latency_ms_wall)),
    medianTokensTotal: median(rows.map((row) => row.tokens.total)),
    medianToolCalls: median(rows.map((row) => row.tool_calls))
  }
}

export function buildSummary(
  rows: BenchmarkRow[],
  thresholds: GateThresholds = DEFAULT_THRESHOLDS
): BenchmarkSummary {
  const grouped: Partial<Record<BenchmarkMode, BenchmarkRow[]>> = {}
  for (const row of rows) {
    const existing = grouped[row.mode] ?? []
    grouped[row.mode] = [...existing, row]
  }

  const modeSummaries: Partial<Record<BenchmarkMode, ModeSummary>> = {}
  for (const mode of Object.keys(grouped) as BenchmarkMode[]) {
    modeSummaries[mode] = summarizeMode(mode, grouped[mode] ?? [])
  }

  const agentDirect = modeSummaries.agent_direct
  const ghxRouter = modeSummaries.ghx_router

  let deltaVsAgentDirect: DeltaSummary | null = null
  let checks: BenchmarkSummary["gate"]["checks"] = []

  if (agentDirect && ghxRouter) {
    deltaVsAgentDirect = {
      tokensReductionPct: safeReductionPct(agentDirect.medianTokensTotal, ghxRouter.medianTokensTotal),
      latencyReductionPct: safeReductionPct(agentDirect.medianLatencyMs, ghxRouter.medianLatencyMs),
      toolCallReductionPct: safeReductionPct(agentDirect.medianToolCalls, ghxRouter.medianToolCalls),
      successRateDeltaPct: ghxRouter.successRate - agentDirect.successRate,
      outputValidityRatePct: ghxRouter.outputValidityRate
    }

    checks = [
      {
        name: "tokens_reduction",
        passed: deltaVsAgentDirect.tokensReductionPct >= thresholds.minTokensReductionPct,
        value: deltaVsAgentDirect.tokensReductionPct,
        threshold: thresholds.minTokensReductionPct
      },
      {
        name: "latency_reduction",
        passed: deltaVsAgentDirect.latencyReductionPct >= thresholds.minLatencyReductionPct,
        value: deltaVsAgentDirect.latencyReductionPct,
        threshold: thresholds.minLatencyReductionPct
      },
      {
        name: "tool_call_reduction",
        passed: deltaVsAgentDirect.toolCallReductionPct >= thresholds.minToolCallReductionPct,
        value: deltaVsAgentDirect.toolCallReductionPct,
        threshold: thresholds.minToolCallReductionPct
      },
      {
        name: "success_rate_non_inferior",
        passed: deltaVsAgentDirect.successRateDeltaPct >= -thresholds.maxSuccessRateDropPct,
        value: deltaVsAgentDirect.successRateDeltaPct,
        threshold: -thresholds.maxSuccessRateDropPct
      },
      {
        name: "output_validity",
        passed: deltaVsAgentDirect.outputValidityRatePct >= thresholds.minOutputValidityRatePct,
        value: deltaVsAgentDirect.outputValidityRatePct,
        threshold: thresholds.minOutputValidityRatePct
      }
    ]
  }

  return {
    generatedAt: new Date().toISOString(),
    modes: modeSummaries,
    deltaVsAgentDirect,
    gate: {
      passed: checks.length > 0 && checks.every((check) => check.passed),
      checks
    }
  }
}

export function toMarkdown(summary: BenchmarkSummary): string {
  const lines: string[] = []
  lines.push("# Benchmark Validation Summary")
  lines.push("")
  lines.push(`Generated: ${summary.generatedAt}`)
  lines.push("")
  lines.push("## Mode Metrics")
  lines.push("")
  lines.push("| Mode | Runs | Success % | Output Valid % | Median Latency (ms) | Median Tokens | Median Tool Calls |")
  lines.push("|---|---:|---:|---:|---:|---:|---:|")

  for (const mode of ["agent_direct", "mcp", "ghx_router"] as const) {
    const item = summary.modes[mode]
    if (!item) continue
    lines.push(
      `| ${mode} | ${item.runs} | ${item.successRate.toFixed(2)} | ${item.outputValidityRate.toFixed(2)} | ${item.medianLatencyMs.toFixed(0)} | ${item.medianTokensTotal.toFixed(0)} | ${item.medianToolCalls.toFixed(1)} |`
    )
  }

  lines.push("")
  lines.push("## Gate Results")
  lines.push("")

  if (!summary.deltaVsAgentDirect) {
    lines.push("Insufficient data: need both agent_direct and ghx_router runs to evaluate gate.")
    return lines.join("\n")
  }

  lines.push(`Overall Gate: **${summary.gate.passed ? "PASS" : "FAIL"}**`)
  lines.push("")
  lines.push("| Check | Value | Threshold | Pass |")
  lines.push("|---|---:|---:|:---:|")
  for (const check of summary.gate.checks) {
    lines.push(`| ${check.name} | ${check.value.toFixed(2)} | ${check.threshold.toFixed(2)} | ${check.passed ? "Y" : "N"} |`)
  }

  return lines.join("\n")
}
