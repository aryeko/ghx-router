import type { BenchmarkRow, ModeSummary } from "@bench/domain/types.js"
import { DEFAULT_GATE_THRESHOLDS, evaluateGate, extractGateEfficiency } from "@bench/report/gate.js"
import { describe, expect, it } from "vitest"

function row(overrides: Partial<BenchmarkRow> = {}): BenchmarkRow {
  return {
    timestamp: "2026-02-13T00:00:00.000Z",
    run_id: "run",
    mode: "agent_direct",
    scenario_id: "s1",
    scenario_set: null,
    iteration: 1,
    session_id: "session",
    success: true,
    output_valid: true,
    latency_ms_wall: 100,
    sdk_latency_ms: 90,
    tokens: {
      input: 10,
      output: 10,
      reasoning: 5,
      cache_read: 0,
      cache_write: 0,
      total: 25,
    },
    cost: 0.01,
    tool_calls: 4,
    api_calls: 2,
    internal_retry_count: 0,
    external_retry_count: 0,
    model: { provider_id: "openai", model_id: "gpt-4", mode: null },
    git: { repo: null, commit: null },
    error: null,
    ...overrides,
  }
}

function modeSummary(overrides: Partial<ModeSummary> = {}): ModeSummary {
  return {
    mode: "ghx",
    modelSignature: "openai/gpt-4",
    runs: 3,
    successRate: 100,
    outputValidityRate: 100,
    runnerFailureRate: 0,
    timeoutStallRate: 0,
    retryRate: 0,
    medianLatencyMs: 70,
    medianTokensTotal: 80,
    medianTokensActive: 80,
    medianToolCalls: 3,
    p90LatencyMs: 80,
    p95LatencyMs: 90,
    iqrLatencyMs: 10,
    cvLatency: 0.1,
    p90TokensActive: 90,
    p95TokensActive: 100,
    medianCostUsd: 0.005,
    ...overrides,
  }
}

describe("extractGateEfficiency", () => {
  it("returns all zero values for empty arrays", () => {
    const efficiency = extractGateEfficiency([], [], 1)

    expect(efficiency.tokensActiveReductionPct).toBe(0)
    expect(efficiency.latencyReductionPct).toBe(0)
    expect(efficiency.toolCallReductionPct).toBe(0)
    expect(efficiency.coveragePct).toBe(0)
    expect(efficiency.totalScenarioCount).toBe(0)
    expect(efficiency.eligibleScenarioCount).toBe(0)
  })

  it("computes positive token reduction when ghx uses fewer tokens", () => {
    const agentRows = [
      row({ mode: "agent_direct", scenario_id: "s1", tokens: { ...row().tokens, total: 100 } }),
    ]
    const ghxRows = [
      row({ mode: "ghx", scenario_id: "s1", tokens: { ...row().tokens, total: 70 } }),
    ]

    const efficiency = extractGateEfficiency(agentRows, ghxRows, 1)

    expect(efficiency.tokensActiveReductionPct).toBeGreaterThan(0)
  })

  it("computes positive tool call reduction when ghx uses fewer tool calls", () => {
    const agentRows = [row({ mode: "agent_direct", scenario_id: "s1", tool_calls: 10 })]
    const ghxRows = [row({ mode: "ghx", scenario_id: "s1", tool_calls: 6 })]

    const efficiency = extractGateEfficiency(agentRows, ghxRows, 1)

    expect(efficiency.toolCallReductionPct).toBeGreaterThan(0)
  })

  it("skips scenarios with insufficient samples", () => {
    const agentRows = [row({ mode: "agent_direct", scenario_id: "s1" })]
    const ghxRows = [row({ mode: "ghx", scenario_id: "s1" })]

    const efficiency = extractGateEfficiency(agentRows, ghxRows, 2)

    expect(efficiency.eligibleScenarioCount).toBe(0)
    expect(efficiency.coveragePct).toBe(0)
  })

  it("computes coverage percentage correctly with multiple scenarios", () => {
    const agentRows = [
      row({ mode: "agent_direct", scenario_id: "s1" }),
      row({ mode: "agent_direct", scenario_id: "s2" }),
    ]
    const ghxRows = [
      row({ mode: "ghx", scenario_id: "s1" }),
      row({ mode: "ghx", scenario_id: "s2" }),
    ]

    const efficiency = extractGateEfficiency(agentRows, ghxRows, 1)

    expect(efficiency.totalScenarioCount).toBe(2)
    expect(efficiency.eligibleScenarioCount).toBe(2)
    expect(efficiency.coveragePct).toBe(100)
  })

  it("skips token reduction when agent tokens are zero", () => {
    const agentRows = [
      row({
        mode: "agent_direct",
        scenario_id: "s1",
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 0 },
      }),
    ]
    const ghxRows = [
      row({
        mode: "ghx",
        scenario_id: "s1",
        tokens: { input: 1, output: 1, reasoning: 0, cache_read: 0, cache_write: 0, total: 2 },
      }),
    ]

    const efficiency = extractGateEfficiency(agentRows, ghxRows, 1)

    expect(efficiency.tokensComparableScenarioCount).toBe(0)
    expect(efficiency.tokensActiveReductionPct).toBe(0)
  })

  it("excludes failed or invalid output rows from efficiency", () => {
    const agentRows = [
      row({
        mode: "agent_direct",
        scenario_id: "s1",
        success: false,
        output_valid: false,
      }),
    ]
    const ghxRows = [row({ mode: "ghx", scenario_id: "s1", success: true, output_valid: true })]

    const efficiency = extractGateEfficiency(agentRows, ghxRows, 1)

    expect(efficiency.eligibleScenarioCount).toBe(0)
  })

  it("excludes rows with runner errors from efficiency", () => {
    const agentRows = [
      row({
        mode: "agent_direct",
        scenario_id: "s1",
        success: true,
        output_valid: true,
        error: null,
      }),
    ]
    const ghxRows = [
      row({
        mode: "ghx",
        scenario_id: "s1",
        success: true,
        output_valid: true,
        error: { type: "runner_error", message: "timeout" },
      }),
    ]

    const efficiency = extractGateEfficiency(agentRows, ghxRows, 1)

    expect(efficiency.eligibleScenarioCount).toBe(0)
  })

  it("computes median reductions correctly", () => {
    const agentRows = [
      row({ mode: "agent_direct", scenario_id: "s1", tool_calls: 10 }),
      row({ mode: "agent_direct", scenario_id: "s2", tool_calls: 20 }),
    ]
    const ghxRows = [
      row({ mode: "ghx", scenario_id: "s1", tool_calls: 5 }),
      row({ mode: "ghx", scenario_id: "s2", tool_calls: 10 }),
    ]

    const efficiency = extractGateEfficiency(agentRows, ghxRows, 1)

    expect(efficiency.eligibleScenarioCount).toBe(2)
    expect(efficiency.toolCallReductionPct).toBeGreaterThan(0)
  })
})

describe("evaluateGate - failing scenarios", () => {
  it("returns passed=false and null reliability/efficiency when agent_direct mode missing", () => {
    const modeSummaries = { ghx: modeSummary() }
    const grouped = { ghx: [row({ mode: "ghx" })] }

    const gate = evaluateGate(modeSummaries, grouped, "verify_pr", DEFAULT_GATE_THRESHOLDS)

    expect(gate.passed).toBe(false)
    expect(gate.reliability).toBeNull()
    expect(gate.efficiency).toBeNull()
    expect(gate.checks).toHaveLength(0)
  })

  it("returns passed=false and null reliability/efficiency when ghx mode missing", () => {
    const modeSummaries = { agent_direct: modeSummary({ mode: "agent_direct" }) }
    const grouped = { agent_direct: [row({ mode: "agent_direct" })] }

    const gate = evaluateGate(modeSummaries, grouped, "verify_pr", DEFAULT_GATE_THRESHOLDS)

    expect(gate.passed).toBe(false)
    expect(gate.reliability).toBeNull()
    expect(gate.efficiency).toBeNull()
  })

  it("returns passed=false when success rate drop exceeds threshold", () => {
    const agentDirect = modeSummary({
      mode: "agent_direct",
      successRate: 100,
      medianCostUsd: 0.1,
    })
    const ghx = modeSummary({
      mode: "ghx",
      successRate: 95,
      outputValidityRate: 100,
      runnerFailureRate: 0,
      timeoutStallRate: 0,
      retryRate: 0,
      medianCostUsd: 0.08,
    })
    const modeSummaries = { agent_direct: agentDirect, ghx }
    const agentRows = [row({ mode: "agent_direct", scenario_id: "s1" })]
    const ghxRows = [row({ mode: "ghx", scenario_id: "s1" })]

    const gate = evaluateGate(
      modeSummaries,
      { agent_direct: agentRows, ghx: ghxRows },
      "verify_pr",
      DEFAULT_GATE_THRESHOLDS,
    )

    expect(gate.passed).toBe(false)
    const successCheck = gate.checks.find(
      (check) => check.name === "reliability_success_rate_non_inferior",
    )
    expect(successCheck?.passed).toBe(false)
  })

  it("returns passed=false when output validity rate below threshold", () => {
    const agentDirect = modeSummary({
      mode: "agent_direct",
      successRate: 100,
      medianCostUsd: 0.1,
    })
    const ghx = modeSummary({
      mode: "ghx",
      successRate: 100,
      outputValidityRate: 95,
      runnerFailureRate: 0,
      timeoutStallRate: 0,
      retryRate: 0,
      medianCostUsd: 0.08,
    })
    const modeSummaries = { agent_direct: agentDirect, ghx }
    const agentRows = [row({ mode: "agent_direct", scenario_id: "s1" })]
    const ghxRows = [row({ mode: "ghx", scenario_id: "s1" })]

    const gate = evaluateGate(
      modeSummaries,
      { agent_direct: agentRows, ghx: ghxRows },
      "verify_pr",
      DEFAULT_GATE_THRESHOLDS,
    )

    expect(gate.passed).toBe(false)
    const validityCheck = gate.checks.find((check) => check.name === "reliability_output_validity")
    expect(validityCheck?.passed).toBe(false)
  })

  it("handles zero cost for cost reduction check", () => {
    const modeSummaries = {
      agent_direct: modeSummary({ mode: "agent_direct", medianCostUsd: 0 }),
      ghx: modeSummary({ mode: "ghx", medianCostUsd: 0 }),
    }
    const rows = [row({ mode: "agent_direct" })]

    const gate = evaluateGate(
      modeSummaries,
      { agent_direct: rows, ghx: rows },
      "verify_pr",
      DEFAULT_GATE_THRESHOLDS,
    )

    const costCheck = gate.checks.find((c) => c.name === "efficiency_cost_reduction")
    expect(costCheck?.value).toBe(0)
  })
})
