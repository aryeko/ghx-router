import { DEFAULT_GATE_THRESHOLDS, evaluateGate } from "@bench/report/gate.js"
import { describe, expect, it } from "vitest"
import { makeModeSummary, makeRow } from "../../helpers/report-fixtures.js"

const row = makeRow
const modeSummary = makeModeSummary

describe("evaluateGate - passing scenarios", () => {
  it("returns passed=true when all thresholds are met", () => {
    const agentDirect = modeSummary({
      mode: "agent_direct",
      successRate: 98,
      medianCostUsd: 0.1,
    })
    const ghx = modeSummary({
      mode: "ghx",
      successRate: 99,
      outputValidityRate: 100,
      runnerFailureRate: 0,
      timeoutStallRate: 0,
      retryRate: 0,
      medianCostUsd: 0.08,
    })
    const modeSummaries = { agent_direct: agentDirect, ghx }
    const agentRows = Array.from({ length: 3 }, (_, i) =>
      row({
        mode: "agent_direct",
        scenario_id: `s${i}`,
        tool_calls: 10,
        latency_ms_wall: 200,
        latency_ms_agent: 140,
        tokens: { input: 50, output: 50, reasoning: 0, cache_read: 0, cache_write: 0, total: 100 },
      }),
    )
    const ghxRows = Array.from({ length: 3 }, (_, i) =>
      row({
        mode: "ghx",
        scenario_id: `s${i}`,
        tool_calls: 6,
        latency_ms_wall: 100,
        latency_ms_agent: 70,
        tokens: { input: 20, output: 30, reasoning: 0, cache_read: 0, cache_write: 0, total: 50 },
      }),
    )

    const gate = evaluateGate(
      modeSummaries,
      { agent_direct: agentRows, ghx: ghxRows },
      "verify_pr",
      DEFAULT_GATE_THRESHOLDS,
    )

    expect(gate.passed).toBe(true)
    expect(gate.reliability).not.toBeNull()
    expect(gate.efficiency).not.toBeNull()
  })

  it("computes reliability metrics correctly", () => {
    const agentDirect = modeSummary({
      mode: "agent_direct",
      successRate: 98,
      medianCostUsd: 0.1,
    })
    const ghx = modeSummary({
      mode: "ghx",
      successRate: 99,
      outputValidityRate: 99.5,
      runnerFailureRate: 1,
      timeoutStallRate: 0.5,
      retryRate: 2,
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

    expect(gate.reliability?.successRateDeltaPct).toBe(1)
    expect(gate.reliability?.outputValidityRatePct).toBe(99.5)
    expect(gate.reliability?.runnerFailureRatePct).toBe(1)
    expect(gate.reliability?.timeoutStallRatePct).toBe(0.5)
    expect(gate.reliability?.retryRatePct).toBe(2)
  })

  it("includes cost reduction check", () => {
    const modeSummaries = {
      agent_direct: modeSummary({ mode: "agent_direct", medianCostUsd: 0.1 }),
      ghx: modeSummary({ mode: "ghx", medianCostUsd: 0.08 }),
    }
    const rows = [row({ mode: "agent_direct" })]

    const gate = evaluateGate(
      modeSummaries,
      { agent_direct: rows, ghx: rows },
      "verify_pr",
      DEFAULT_GATE_THRESHOLDS,
    )

    const costCheck = gate.checks.find((c) => c.name === "efficiency_cost_reduction")
    expect(costCheck).toBeDefined()
    expect(costCheck?.value).toBeGreaterThan(0)
    expect(costCheck?.operator).toBe(">=")
  })

  it("uses verify_pr thresholds with stricter verify_release constraints", () => {
    const modeSummaries = {
      agent_direct: modeSummary({ mode: "agent_direct" }),
      ghx: modeSummary({ mode: "ghx" }),
    }
    const rows = [row({ mode: "agent_direct" })]

    const prGate = evaluateGate(
      modeSummaries,
      { agent_direct: rows, ghx: rows },
      "verify_pr",
      DEFAULT_GATE_THRESHOLDS,
    )
    const releaseGate = evaluateGate(
      modeSummaries,
      { agent_direct: rows, ghx: rows },
      "verify_release",
      DEFAULT_GATE_THRESHOLDS,
    )

    expect(prGate.profile).toBe("verify_pr")
    expect(releaseGate.profile).toBe("verify_release")
  })

  it("check array has correct operators for each metric", () => {
    const modeSummaries = {
      agent_direct: modeSummary({ mode: "agent_direct" }),
      ghx: modeSummary({ mode: "ghx" }),
    }
    const rows = [row({ mode: "agent_direct" })]

    const gate = evaluateGate(
      modeSummaries,
      { agent_direct: rows, ghx: rows },
      "verify_pr",
      DEFAULT_GATE_THRESHOLDS,
    )

    const reliabilitySuccessCheck = gate.checks.find(
      (c) => c.name === "reliability_success_rate_non_inferior",
    )
    expect(reliabilitySuccessCheck?.operator).toBe(">=")

    const runnerFailureCheck = gate.checks.find((c) => c.name === "reliability_runner_failure_rate")
    expect(runnerFailureCheck?.operator).toBe("<=")

    const efficiencyCheck = gate.checks.find((c) => c.name === "efficiency_tokens_active_reduction")
    expect(efficiencyCheck?.operator).toBe(">=")
  })
})
