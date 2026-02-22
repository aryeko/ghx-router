import type {
  BenchmarkMode,
  BenchmarkRow,
  GateCheck,
  GateEfficiency,
  GateProfile,
  GateReliability,
  GateSummary,
  GateThresholdMap,
  ModeSummary,
} from "../domain/types.js"

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

function isStableEfficiencyRow(row: BenchmarkRow): boolean {
  return row.success && row.output_valid && !isRunnerError(row)
}

export const DEFAULT_GATE_THRESHOLDS: GateThresholdMap = {
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

export function extractGateEfficiency(
  agentDirectRows: BenchmarkRow[],
  ghxRouterRows: BenchmarkRow[],
  minSamplesPerScenarioPerMode: number,
): GateEfficiency {
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

export function evaluateGate(
  modeSummaries: Partial<Record<BenchmarkMode, ModeSummary>>,
  grouped: Partial<Record<BenchmarkMode, BenchmarkRow[]>>,
  profile: GateProfile,
  gateThresholds: GateThresholdMap,
): GateSummary {
  const thresholds = gateThresholds[profile]
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

  const reliability: GateReliability = {
    successRateDeltaPct: ghxRouter.successRate - agentDirect.successRate,
    outputValidityRatePct: ghxRouter.outputValidityRate,
    runnerFailureRatePct: ghxRouter.runnerFailureRate,
    timeoutStallRatePct: ghxRouter.timeoutStallRate,
    retryRatePct: ghxRouter.retryRate,
  }

  const efficiency = extractGateEfficiency(
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
    (() => {
      const costReduction =
        ghxRouter.medianCostUsd > 0 && agentDirect.medianCostUsd > 0
          ? safeReductionPct(agentDirect.medianCostUsd, ghxRouter.medianCostUsd)
          : 0
      return {
        name: "efficiency_cost_reduction" as const,
        passed: costReduction >= thresholds.minCostReductionPct,
        value: costReduction,
        threshold: thresholds.minCostReductionPct,
        operator: ">=" as const,
      }
    })(),
  ]

  return {
    profile,
    passed: checks.every((check) => check.passed),
    reliability,
    efficiency,
    checks,
  }
}
