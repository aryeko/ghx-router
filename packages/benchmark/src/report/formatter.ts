import type { BenchmarkSummary } from "../domain/types.js"

export function toMarkdown(summary: BenchmarkSummary): string {
  const lines: string[] = []
  lines.push("# Benchmark Validation Summary")
  lines.push("")
  lines.push(`Generated: ${summary.generatedAt}`)
  lines.push("")
  lines.push("## Mode Metrics")
  lines.push("")
  lines.push(
    "| Mode | Model | Runs | Success % | Output Valid % | Runner Error % | Timeout/Stall % | Retry % | Median Agent Time (ms) | Median Wall Time (ms) | P90 Agent Time (ms) | P95 Agent Time (ms) | IQR Agent Time (ms) | CV Agent Time % | Median Tokens (Total) | Median Tokens (Active) | P90 Tokens (Active) | P95 Tokens (Active) | Median Cost (USD) | Median Tool Calls |",
  )
  lines.push(
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  )

  for (const mode of ["agent_direct", "mcp", "ghx"] as const) {
    const item = summary.modes[mode]
    if (!item) continue
    lines.push(
      `| ${mode} | ${item.modelSignature} | ${item.runs} | ${item.successRate.toFixed(2)} | ${item.outputValidityRate.toFixed(2)} | ${item.runnerFailureRate.toFixed(2)} | ${item.timeoutStallRate.toFixed(2)} | ${item.retryRate.toFixed(2)} | ${item.medianLatencyMs.toFixed(0)} | ${item.medianLatencyMsWall.toFixed(0)} | ${item.p90LatencyMs.toFixed(0)} | ${item.p95LatencyMs.toFixed(0)} | ${item.iqrLatencyMs.toFixed(0)} | ${item.cvLatency.toFixed(2)} | ${item.medianTokensTotal.toFixed(0)} | ${item.medianTokensActive.toFixed(0)} | ${item.p90TokensActive.toFixed(0)} | ${item.p95TokensActive.toFixed(0)} | ${item.medianCostUsd.toFixed(4)} | ${item.medianToolCalls.toFixed(1)} |`,
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
  lines.push("## Gate")
  lines.push("")
  lines.push(`Profile: ${summary.gate.profile}`)
  lines.push(`Overall Gate: **${summary.gate.passed ? "PASS" : "FAIL"}**`)
  lines.push("")

  if (!summary.gate.reliability || !summary.gate.efficiency) {
    lines.push("Insufficient data: need both agent_direct and ghx runs to evaluate gate.")
    return lines.join("\n")
  }

  lines.push("| Check | Value | Rule | Pass |")
  lines.push("|---|---:|---:|:---:|")
  for (const check of summary.gate.checks) {
    lines.push(
      `| ${check.name} | ${check.value.toFixed(2)} | ${check.operator} ${check.threshold.toFixed(2)} | ${check.passed ? "Y" : "N"} |`,
    )
  }

  lines.push("")
  lines.push("### Reliability Snapshot")
  lines.push("")
  lines.push(`- success delta: ${summary.gate.reliability.successRateDeltaPct.toFixed(2)} pp`)
  lines.push(`- output validity: ${summary.gate.reliability.outputValidityRatePct.toFixed(2)}%`)
  lines.push(`- runner failures: ${summary.gate.reliability.runnerFailureRatePct.toFixed(2)}%`)
  lines.push(`- timeout/stalls: ${summary.gate.reliability.timeoutStallRatePct.toFixed(2)}%`)
  lines.push(`- external retries: ${summary.gate.reliability.retryRatePct.toFixed(2)}%`)

  lines.push("")
  lines.push("### Efficiency Snapshot (Stable Sample)")
  lines.push("")
  lines.push(
    `- scenario coverage: ${summary.gate.efficiency.coveragePct.toFixed(2)}% (${summary.gate.efficiency.eligibleScenarioCount}/${summary.gate.efficiency.totalScenarioCount})`,
  )
  lines.push(
    `- median active-token reduction: ${summary.gate.efficiency.tokensActiveReductionPct.toFixed(2)}%`,
  )
  lines.push(
    `- median latency reduction: ${summary.gate.efficiency.latencyReductionPct.toFixed(2)}%`,
  )
  lines.push(
    `- median tool-call reduction: ${summary.gate.efficiency.toolCallReductionPct.toFixed(2)}%`,
  )
  lines.push(
    `- scenario win-rate (active tokens): ${summary.gate.efficiency.scenarioWinRateTokensActivePct.toFixed(2)}% (${summary.gate.efficiency.tokensComparableScenarioCount} comparable scenarios)`,
  )

  if (summary.delta) {
    lines.push("")
    lines.push("### Delta vs Agent Direct")
    lines.push("")
    lines.push(`- cost reduction: ${summary.delta.costReductionPct.toFixed(2)}%`)
    lines.push(
      `- tokens active reduction CI: [${summary.delta.tokensActiveReductionCI[0].toFixed(2)}, ${summary.delta.tokensActiveReductionCI[1].toFixed(2)}]`,
    )
    lines.push(
      `- latency reduction CI: [${summary.delta.latencyReductionCI[0].toFixed(2)}, ${summary.delta.latencyReductionCI[1].toFixed(2)}]`,
    )
  }

  return lines.join("\n")
}

export function toJson(summary: BenchmarkSummary): string {
  return JSON.stringify(summary, null, 2)
}
