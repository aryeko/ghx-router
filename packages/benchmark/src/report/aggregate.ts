import type {
  BenchmarkMode,
  BenchmarkRow,
  BenchmarkSummary,
  GateProfile,
  GateV2ThresholdMap,
  GateV2Thresholds,
} from "../domain/types.js"
import { bootstrapCI, coefficientOfVariation, iqr, percentile } from "./statistics.js"

export type { GateProfile, GateV2ThresholdMap, GateV2Thresholds, BenchmarkSummary }

type GateCheck = {
  name: string
  passed: boolean
  value: number
  threshold: number
  operator: ">=" | "<="
}

type ModeSummary = {
  mode: BenchmarkMode
  modelSignature: string
  runs: number
  successRate: number
  outputValidityRate: number
  runnerFailureRate: number
  timeoutStallRate: number
  retryRate: number
  medianLatencyMs: number
  medianTokensTotal: number
  medianTokensActive: number
  medianToolCalls: number
  p90LatencyMs: number
  p95LatencyMs: number
  iqrLatencyMs: number
  cvLatency: number
  p90TokensActive: number
  p95TokensActive: number
  medianCostUsd: number
}

type ProfilingSummary = {
  runsWithProfiling: number
  medianAssistantTotalMs: number
  medianAssistantReasoningMs: number
  medianAssistantBetweenReasoningAndToolMs: number
  medianToolTotalMs: number
  medianToolBashMs: number
  medianAssistantPostToolMs: number
}

type DeltaSummary = {
  tokensReductionPct: number
  tokensActiveReductionPct: number
  latencyReductionPct: number
  toolCallReductionPct: number
  successRateDeltaPct: number
  outputValidityRatePct: number
  costReductionPct: number
  tokensActiveReductionCI: [number, number]
  latencyReductionCI: [number, number]
}

type GateV2Reliability = {
  successRateDeltaPct: number
  outputValidityRatePct: number
  runnerFailureRatePct: number
  timeoutStallRatePct: number
  retryRatePct: number
}

type GateV2Efficiency = {
  minSamplesPerScenarioPerMode: number
  eligibleScenarioCount: number
  totalScenarioCount: number
  coveragePct: number
  tokensComparableScenarioCount: number
  tokensActiveReductionPct: number
  latencyReductionPct: number
  toolCallReductionPct: number
  scenarioWinRateTokensActivePct: number
}

type GateV2Summary = {
  profile: GateProfile
  passed: boolean
  reliability: GateV2Reliability | null
  efficiency: GateV2Efficiency | null
  checks: GateCheck[]
}

export const DEFAULT_GATE_V2_THRESHOLDS: GateV2ThresholdMap = {
  verify_pr: {
    minTokensActiveReductionPct: 15,
    minLatencyReductionPct: 15,
    minToolCallReductionPct: 20,
    minEfficiencyCoveragePct: 80,
    maxSuccessRateDropPct: 3,
    minOutputValidityRatePct: 97,
    maxRunnerFailureRatePct: 5,
    maxTimeoutStallRatePct: 2,
    maxRetryRatePct: 15,
    minSamplesPerScenarioPerMode: 1,
    minCostReductionPct: 10,
  },
  verify_release: {
    minTokensActiveReductionPct: 22,
    minLatencyReductionPct: 20,
    minToolCallReductionPct: 30,
    minEfficiencyCoveragePct: 95,
    maxSuccessRateDropPct: 1,
    minOutputValidityRatePct: 99,
    maxRunnerFailureRatePct: 2,
    maxTimeoutStallRatePct: 1,
    maxRetryRatePct: 8,
    minSamplesPerScenarioPerMode: 2,
    minCostReductionPct: 15,
  },
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

function activeTokens(row: BenchmarkRow): number {
  return row.tokens.total - row.tokens.cache_read
}

function isRunnerError(row: BenchmarkRow): boolean {
  return row.error?.type === "runner_error"
}

function isTimeoutStallError(row: BenchmarkRow): boolean {
  if (!isRunnerError(row) || !row.error) {
    return false
  }

  return /\b(timeout|timed out|stalled?|stall)\b/i.test(row.error.message)
}

function isStableEfficiencyRow(row: BenchmarkRow): boolean {
  return row.success && row.output_valid && !isRunnerError(row)
}

function summarizeMode(mode: BenchmarkMode, rows: BenchmarkRow[]): ModeSummary {
  const modelSignature = Array.from(
    new Set(
      rows.map(
        (row) => `${row.model.provider_id}/${row.model.model_id}/${row.model.mode ?? "<null>"}`,
      ),
    ),
  )
    .sort()
    .join(",")

  const latencies = rows.map((row) => row.latency_ms_wall)
  const tokensActiveValues = rows.map((row) => activeTokens(row))
  const costs = rows.map((row) => row.cost)

  return {
    mode,
    modelSignature,
    runs: rows.length,
    successRate: pct(rows.filter((row) => row.success).length, rows.length),
    outputValidityRate: pct(rows.filter((row) => row.output_valid).length, rows.length),
    runnerFailureRate: pct(rows.filter((row) => isRunnerError(row)).length, rows.length),
    timeoutStallRate: pct(rows.filter((row) => isTimeoutStallError(row)).length, rows.length),
    retryRate: pct(rows.filter((row) => row.external_retry_count > 0).length, rows.length),
    medianLatencyMs: median(latencies),
    medianTokensTotal: median(rows.map((row) => row.tokens.total)),
    medianTokensActive: median(tokensActiveValues),
    medianToolCalls: median(rows.map((row) => row.tool_calls)),
    p90LatencyMs: percentile(latencies, 90),
    p95LatencyMs: percentile(latencies, 95),
    iqrLatencyMs: iqr(latencies),
    cvLatency: coefficientOfVariation(latencies),
    p90TokensActive: percentile(tokensActiveValues, 90),
    p95TokensActive: percentile(tokensActiveValues, 95),
    medianCostUsd: median(costs),
  }
}

function summarizeProfiling(rows: BenchmarkRow[]): ProfilingSummary | null {
  const profiledRows = rows.filter((row) => row.timing_breakdown !== undefined)
  if (profiledRows.length === 0) {
    return null
  }

  return {
    runsWithProfiling: profiledRows.length,
    medianAssistantTotalMs: median(
      profiledRows.map((row) => row.timing_breakdown?.assistant_total_ms ?? 0),
    ),
    medianAssistantReasoningMs: median(
      profiledRows.map((row) => row.timing_breakdown?.assistant_reasoning_ms ?? 0),
    ),
    medianAssistantBetweenReasoningAndToolMs: median(
      profiledRows.map((row) => row.timing_breakdown?.assistant_between_reasoning_and_tool_ms ?? 0),
    ),
    medianToolTotalMs: median(profiledRows.map((row) => row.timing_breakdown?.tool_total_ms ?? 0)),
    medianToolBashMs: median(profiledRows.map((row) => row.timing_breakdown?.tool_bash_ms ?? 0)),
    medianAssistantPostToolMs: median(
      profiledRows.map((row) => row.timing_breakdown?.assistant_post_tool_ms ?? 0),
    ),
  }
}

function extractGateV2Efficiency(
  agentDirectRows: BenchmarkRow[],
  ghxRouterRows: BenchmarkRow[],
  minSamplesPerScenarioPerMode: number,
): GateV2Efficiency {
  const totalScenarioCount = new Set([
    ...agentDirectRows.map((row) => row.scenario_id),
    ...ghxRouterRows.map((row) => row.scenario_id),
  ]).size

  const scenarioIds = new Set<string>([
    ...agentDirectRows.map((row) => row.scenario_id),
    ...ghxRouterRows.map((row) => row.scenario_id),
  ])

  const tokenReductions: number[] = []
  const latencyReductions: number[] = []
  const toolCallReductions: number[] = []
  let tokensActiveWinCount = 0
  let tokensComparableScenarioCount = 0
  let eligibleScenarioCount = 0

  for (const scenarioId of scenarioIds) {
    const agentScenarioRows = agentDirectRows.filter(
      (row) => row.scenario_id === scenarioId && isStableEfficiencyRow(row),
    )
    const ghxScenarioRows = ghxRouterRows.filter(
      (row) => row.scenario_id === scenarioId && isStableEfficiencyRow(row),
    )

    if (
      agentScenarioRows.length < minSamplesPerScenarioPerMode ||
      ghxScenarioRows.length < minSamplesPerScenarioPerMode
    ) {
      continue
    }

    eligibleScenarioCount += 1

    const agentTokensActiveMedian = median(agentScenarioRows.map((row) => activeTokens(row)))
    const ghxTokensActiveMedian = median(ghxScenarioRows.map((row) => activeTokens(row)))
    if (agentTokensActiveMedian > 0) {
      const tokenReduction = safeReductionPct(agentTokensActiveMedian, ghxTokensActiveMedian)
      tokenReductions.push(tokenReduction)
      tokensComparableScenarioCount += 1
      if (tokenReduction > 0) {
        tokensActiveWinCount += 1
      }
    }

    const agentLatencyMedian = median(agentScenarioRows.map((row) => row.latency_ms_wall))
    const ghxLatencyMedian = median(ghxScenarioRows.map((row) => row.latency_ms_wall))
    if (agentLatencyMedian > 0) {
      latencyReductions.push(safeReductionPct(agentLatencyMedian, ghxLatencyMedian))
    }

    const agentToolCallsMedian = median(agentScenarioRows.map((row) => row.tool_calls))
    const ghxToolCallsMedian = median(ghxScenarioRows.map((row) => row.tool_calls))
    if (agentToolCallsMedian > 0) {
      toolCallReductions.push(safeReductionPct(agentToolCallsMedian, ghxToolCallsMedian))
    }
  }

  return {
    minSamplesPerScenarioPerMode,
    eligibleScenarioCount,
    totalScenarioCount,
    coveragePct: pct(eligibleScenarioCount, totalScenarioCount),
    tokensComparableScenarioCount,
    tokensActiveReductionPct: median(tokenReductions),
    latencyReductionPct: median(latencyReductions),
    toolCallReductionPct: median(toolCallReductions),
    scenarioWinRateTokensActivePct: pct(tokensActiveWinCount, tokensComparableScenarioCount),
  }
}

function buildGateV2(
  modeSummaries: Partial<Record<BenchmarkMode, ModeSummary>>,
  grouped: Partial<Record<BenchmarkMode, BenchmarkRow[]>>,
  profile: GateProfile,
  gateV2Thresholds: GateV2ThresholdMap,
): GateV2Summary {
  const thresholds = gateV2Thresholds[profile]
  const agentDirect = modeSummaries.agent_direct
  const ghxRouter = modeSummaries.ghx

  if (!agentDirect || !ghxRouter) {
    return {
      profile,
      passed: false,
      reliability: null,
      efficiency: null,
      checks: [],
    }
  }

  const reliability: GateV2Reliability = {
    successRateDeltaPct: ghxRouter.successRate - agentDirect.successRate,
    outputValidityRatePct: ghxRouter.outputValidityRate,
    runnerFailureRatePct: ghxRouter.runnerFailureRate,
    timeoutStallRatePct: ghxRouter.timeoutStallRate,
    retryRatePct: ghxRouter.retryRate,
  }

  const efficiency = extractGateV2Efficiency(
    grouped.agent_direct ?? [],
    grouped.ghx ?? [],
    thresholds.minSamplesPerScenarioPerMode,
  )

  const checks: GateCheck[] = [
    {
      name: "reliability_success_rate_non_inferior",
      passed: reliability.successRateDeltaPct >= -thresholds.maxSuccessRateDropPct,
      value: reliability.successRateDeltaPct,
      threshold: -thresholds.maxSuccessRateDropPct,
      operator: ">=",
    },
    {
      name: "reliability_output_validity",
      passed: reliability.outputValidityRatePct >= thresholds.minOutputValidityRatePct,
      value: reliability.outputValidityRatePct,
      threshold: thresholds.minOutputValidityRatePct,
      operator: ">=",
    },
    {
      name: "reliability_runner_failure_rate",
      passed: reliability.runnerFailureRatePct <= thresholds.maxRunnerFailureRatePct,
      value: reliability.runnerFailureRatePct,
      threshold: thresholds.maxRunnerFailureRatePct,
      operator: "<=",
    },
    {
      name: "reliability_timeout_stall_rate",
      passed: reliability.timeoutStallRatePct <= thresholds.maxTimeoutStallRatePct,
      value: reliability.timeoutStallRatePct,
      threshold: thresholds.maxTimeoutStallRatePct,
      operator: "<=",
    },
    {
      name: "reliability_retry_rate",
      passed: reliability.retryRatePct <= thresholds.maxRetryRatePct,
      value: reliability.retryRatePct,
      threshold: thresholds.maxRetryRatePct,
      operator: "<=",
    },
    {
      name: "efficiency_coverage",
      passed: efficiency.coveragePct >= thresholds.minEfficiencyCoveragePct,
      value: efficiency.coveragePct,
      threshold: thresholds.minEfficiencyCoveragePct,
      operator: ">=",
    },
    {
      name: "efficiency_tokens_active_reduction",
      passed: efficiency.tokensActiveReductionPct >= thresholds.minTokensActiveReductionPct,
      value: efficiency.tokensActiveReductionPct,
      threshold: thresholds.minTokensActiveReductionPct,
      operator: ">=",
    },
    {
      name: "efficiency_latency_reduction",
      passed: efficiency.latencyReductionPct >= thresholds.minLatencyReductionPct,
      value: efficiency.latencyReductionPct,
      threshold: thresholds.minLatencyReductionPct,
      operator: ">=",
    },
    {
      name: "efficiency_tool_call_reduction",
      passed: efficiency.toolCallReductionPct >= thresholds.minToolCallReductionPct,
      value: efficiency.toolCallReductionPct,
      threshold: thresholds.minToolCallReductionPct,
      operator: ">=",
    },
    {
      name: "efficiency_cost_reduction",
      passed:
        ghxRouter.medianCostUsd > 0 && agentDirect.medianCostUsd > 0
          ? safeReductionPct(agentDirect.medianCostUsd, ghxRouter.medianCostUsd) >=
            thresholds.minCostReductionPct
          : false,
      value:
        ghxRouter.medianCostUsd > 0 && agentDirect.medianCostUsd > 0
          ? safeReductionPct(agentDirect.medianCostUsd, ghxRouter.medianCostUsd)
          : 0,
      threshold: thresholds.minCostReductionPct,
      operator: ">=",
    },
  ]

  return {
    profile,
    passed: checks.every((check) => check.passed),
    reliability,
    efficiency,
    checks,
  }
}

export function buildSummary(
  rows: BenchmarkRow[],
  gateProfile: GateProfile = "verify_pr",
  gateV2Thresholds: GateV2ThresholdMap = DEFAULT_GATE_V2_THRESHOLDS,
  timestamp?: string,
): BenchmarkSummary {
  const grouped: Partial<Record<BenchmarkMode, BenchmarkRow[]>> = {}
  for (const row of rows) {
    ;(grouped[row.mode] ??= []).push(row)
  }

  const modeSummaries: Partial<Record<BenchmarkMode, ModeSummary>> = {}
  const profilingSummaries: Partial<Record<BenchmarkMode, ProfilingSummary>> = {}
  for (const mode of Object.keys(grouped) as BenchmarkMode[]) {
    const modeRows = grouped[mode] ?? []
    modeSummaries[mode] = summarizeMode(mode, modeRows)
    const profilingSummary = summarizeProfiling(modeRows)
    if (profilingSummary) {
      profilingSummaries[mode] = profilingSummary
    }
  }

  const agentDirect = modeSummaries.agent_direct
  const ghxRouter = modeSummaries.ghx

  let deltaVsAgentDirect: DeltaSummary | null = null
  if (agentDirect && ghxRouter) {
    const agentDirectTokensActive = grouped.agent_direct ?? []

    deltaVsAgentDirect = {
      tokensReductionPct: safeReductionPct(
        agentDirect.medianTokensTotal,
        ghxRouter.medianTokensTotal,
      ),
      tokensActiveReductionPct: safeReductionPct(
        agentDirect.medianTokensActive,
        ghxRouter.medianTokensActive,
      ),
      latencyReductionPct: safeReductionPct(agentDirect.medianLatencyMs, ghxRouter.medianLatencyMs),
      toolCallReductionPct: safeReductionPct(
        agentDirect.medianToolCalls,
        ghxRouter.medianToolCalls,
      ),
      successRateDeltaPct: ghxRouter.successRate - agentDirect.successRate,
      outputValidityRatePct: ghxRouter.outputValidityRate,
      costReductionPct: safeReductionPct(agentDirect.medianCostUsd, ghxRouter.medianCostUsd),
      tokensActiveReductionCI: bootstrapCI(
        agentDirectTokensActive.map((row) => activeTokens(row)).filter((v) => v > 0),
      ),
      latencyReductionCI: bootstrapCI(agentDirectTokensActive.map((row) => row.latency_ms_wall)),
    }
  }

  return {
    generatedAt: timestamp ?? new Date().toISOString(),
    modes: modeSummaries,
    profiling: profilingSummaries,
    deltaVsAgentDirect,
    gateV2: buildGateV2(modeSummaries, grouped, gateProfile, gateV2Thresholds),
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
  lines.push(
    "| Mode | Model | Runs | Success % | Output Valid % | Runner Error % | Timeout/Stall % | Retry % | Median Latency (ms) | P90 Latency (ms) | P95 Latency (ms) | IQR Latency (ms) | CV Latency % | Median Tokens (Total) | Median Tokens (Active) | P90 Tokens (Active) | P95 Tokens (Active) | Median Cost (USD) | Median Tool Calls |",
  )
  lines.push(
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  )

  for (const mode of ["agent_direct", "mcp", "ghx"] as const) {
    const item = summary.modes[mode]
    if (!item) continue
    lines.push(
      `| ${mode} | ${item.modelSignature} | ${item.runs} | ${item.successRate.toFixed(2)} | ${item.outputValidityRate.toFixed(2)} | ${item.runnerFailureRate.toFixed(2)} | ${item.timeoutStallRate.toFixed(2)} | ${item.retryRate.toFixed(2)} | ${item.medianLatencyMs.toFixed(0)} | ${item.p90LatencyMs.toFixed(0)} | ${item.p95LatencyMs.toFixed(0)} | ${item.iqrLatencyMs.toFixed(0)} | ${item.cvLatency.toFixed(2)} | ${item.medianTokensTotal.toFixed(0)} | ${item.medianTokensActive.toFixed(0)} | ${item.p90TokensActive.toFixed(0)} | ${item.p95TokensActive.toFixed(0)} | ${item.medianCostUsd.toFixed(4)} | ${item.medianToolCalls.toFixed(1)} |`,
    )
  }

  lines.push("")
  lines.push("## Profiling Snapshot")
  lines.push("")
  lines.push(
    "| Mode | Profiled Runs | Assistant Total (ms) | Reasoning (ms) | Between Reasoning->Tool (ms) | Tool Total (ms) | Bash Tool (ms) | Post-Tool (ms) |",
  )
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|")

  for (const mode of ["agent_direct", "mcp", "ghx"] as const) {
    const item = summary.profiling[mode]
    if (!item) continue
    lines.push(
      `| ${mode} | ${item.runsWithProfiling} | ${item.medianAssistantTotalMs.toFixed(0)} | ${item.medianAssistantReasoningMs.toFixed(0)} | ${item.medianAssistantBetweenReasoningAndToolMs.toFixed(0)} | ${item.medianToolTotalMs.toFixed(0)} | ${item.medianToolBashMs.toFixed(0)} | ${item.medianAssistantPostToolMs.toFixed(0)} |`,
    )
  }

  lines.push("")
  lines.push("## Gate V2")
  lines.push("")
  lines.push(`Profile: ${summary.gateV2.profile}`)
  lines.push(`Overall Gate: **${summary.gateV2.passed ? "PASS" : "FAIL"}**`)
  lines.push("")

  if (!summary.gateV2.reliability || !summary.gateV2.efficiency) {
    lines.push("Insufficient data: need both agent_direct and ghx runs to evaluate gate v2.")
    return lines.join("\n")
  }

  lines.push("| Check | Value | Rule | Pass |")
  lines.push("|---|---:|---:|:---:|")
  for (const check of summary.gateV2.checks) {
    lines.push(
      `| ${check.name} | ${check.value.toFixed(2)} | ${check.operator} ${check.threshold.toFixed(2)} | ${check.passed ? "Y" : "N"} |`,
    )
  }

  lines.push("")
  lines.push("### Reliability Snapshot")
  lines.push("")
  lines.push(`- success delta: ${summary.gateV2.reliability.successRateDeltaPct.toFixed(2)} pp`)
  lines.push(`- output validity: ${summary.gateV2.reliability.outputValidityRatePct.toFixed(2)}%`)
  lines.push(`- runner failures: ${summary.gateV2.reliability.runnerFailureRatePct.toFixed(2)}%`)
  lines.push(`- timeout/stalls: ${summary.gateV2.reliability.timeoutStallRatePct.toFixed(2)}%`)
  lines.push(`- external retries: ${summary.gateV2.reliability.retryRatePct.toFixed(2)}%`)

  lines.push("")
  lines.push("### Efficiency Snapshot (Stable Sample)")
  lines.push("")
  lines.push(
    `- scenario coverage: ${summary.gateV2.efficiency.coveragePct.toFixed(2)}% (${summary.gateV2.efficiency.eligibleScenarioCount}/${summary.gateV2.efficiency.totalScenarioCount})`,
  )
  lines.push(
    `- median active-token reduction: ${summary.gateV2.efficiency.tokensActiveReductionPct.toFixed(2)}%`,
  )
  lines.push(
    `- median latency reduction: ${summary.gateV2.efficiency.latencyReductionPct.toFixed(2)}%`,
  )
  lines.push(
    `- median tool-call reduction: ${summary.gateV2.efficiency.toolCallReductionPct.toFixed(2)}%`,
  )
  lines.push(
    `- scenario win-rate (active tokens): ${summary.gateV2.efficiency.scenarioWinRateTokensActivePct.toFixed(2)}% (${summary.gateV2.efficiency.tokensComparableScenarioCount} comparable scenarios)`,
  )

  if (summary.deltaVsAgentDirect) {
    lines.push("")
    lines.push("### Delta vs Agent Direct")
    lines.push("")
    lines.push(`- cost reduction: ${summary.deltaVsAgentDirect.costReductionPct.toFixed(2)}%`)
    lines.push(
      `- tokens active reduction CI: [${summary.deltaVsAgentDirect.tokensActiveReductionCI[0].toFixed(2)}, ${summary.deltaVsAgentDirect.tokensActiveReductionCI[1].toFixed(2)}]`,
    )
    lines.push(
      `- latency reduction CI: [${summary.deltaVsAgentDirect.latencyReductionCI[0].toFixed(2)}, ${summary.deltaVsAgentDirect.latencyReductionCI[1].toFixed(2)}]`,
    )
  }

  return lines.join("\n")
}
