import type {
  BenchmarkMode,
  BenchmarkRow,
  BenchmarkSummary,
  DeltaSummary,
  GateProfile,
  GateThresholdMap,
  ModeSummary,
  ProfilingSummary,
} from "../domain/types.js"
import { DEFAULT_GATE_THRESHOLDS, evaluateGate } from "./gate.js"
import { bootstrapCI, coefficientOfVariation, iqr, percentile } from "./statistics.js"

export type { GateProfile, GateThresholdMap, BenchmarkSummary }

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

function computeModeSummary(mode: BenchmarkMode, rows: BenchmarkRow[]): ModeSummary {
  const modelSignature = Array.from(
    new Set(
      rows.map(
        (row) => `${row.model.provider_id}/${row.model.model_id}/${row.model.mode ?? "<null>"}`,
      ),
    ),
  )
    .sort()
    .join(",")

  const latencies = rows.map((row) => row.latency_ms_agent)
  const wallLatencies = rows.map((row) => row.latency_ms_wall)
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
    medianLatencyMsWall: median(wallLatencies),
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

function computeProfiling(rows: BenchmarkRow[]): ProfilingSummary | null {
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

export function buildSummary(
  rows: BenchmarkRow[],
  gateProfile: GateProfile = "verify_pr",
  gateThresholds: GateThresholdMap = DEFAULT_GATE_THRESHOLDS,
  timestamp?: string,
): BenchmarkSummary {
  const grouped = rows.reduce<Partial<Record<BenchmarkMode, BenchmarkRow[]>>>(
    (acc, row) => ({ ...acc, [row.mode]: [...(acc[row.mode] ?? []), row] }),
    {},
  )

  const modeSummaries: Partial<Record<BenchmarkMode, ModeSummary>> = {}
  const profilingSummaries: Partial<Record<BenchmarkMode, ProfilingSummary>> = {}
  for (const mode of Object.keys(grouped) as BenchmarkMode[]) {
    const modeRows = grouped[mode] ?? []
    modeSummaries[mode] = computeModeSummary(mode, modeRows)
    const profilingSummary = computeProfiling(modeRows)
    if (profilingSummary) {
      profilingSummaries[mode] = profilingSummary
    }
  }

  const agentDirect = modeSummaries.agent_direct
  const ghxRouter = modeSummaries.ghx

  let delta: DeltaSummary | null = null
  if (agentDirect && ghxRouter) {
    const agentDirectRows = grouped.agent_direct ?? []

    delta = {
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
        agentDirectRows.map((row) => activeTokens(row)).filter((v) => v > 0),
      ),
      latencyReductionCI: bootstrapCI(agentDirectRows.map((row) => row.latency_ms_agent)),
    }
  }

  return {
    generatedAt: timestamp ?? new Date().toISOString(),
    modes: modeSummaries,
    profiling: profilingSummaries,
    delta,
    gate: evaluateGate(modeSummaries, grouped, gateProfile, gateThresholds),
  }
}
