import { describe, expect, it } from "vitest"

import { buildSummary } from "../../src/report/aggregate.js"
import type { BenchmarkRow } from "../../src/domain/types.js"

function row(overrides: Partial<BenchmarkRow>): BenchmarkRow {
  return {
    timestamp: "2026-02-13T00:00:00.000Z",
    run_id: "run",
    mode: "agent_direct",
    scenario_id: "repo-view-001",
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
      total: 25
    },
    cost: 0,
    tool_calls: 4,
    api_calls: 2,
    retry_count: 0,
    model: {
      provider_id: "openai",
      model_id: "gpt-5.3-codex",
      mode: null
    },
    git: {
      repo: "aryeko/ghx-router",
      commit: "abc"
    },
    error: null,
    ...overrides
  }
}

describe("buildSummary", () => {
  it("computes gate pass when ghx_router beats baseline", () => {
    const rows: BenchmarkRow[] = [
      row({ mode: "agent_direct", latency_ms_wall: 100, tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 100 }, tool_calls: 10, success: true, output_valid: true }),
      row({ mode: "ghx_router", latency_ms_wall: 70, tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 70 }, tool_calls: 6, success: true, output_valid: true })
    ]

    const summary = buildSummary(rows)

    expect(summary.deltaVsAgentDirect).not.toBeNull()
    expect(summary.gate.passed).toBe(true)
  })

  it("computes gate fail when thresholds not met", () => {
    const rows: BenchmarkRow[] = [
      row({ mode: "agent_direct", latency_ms_wall: 100, tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 100 }, tool_calls: 10, success: true, output_valid: true }),
      row({ mode: "ghx_router", latency_ms_wall: 95, tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 99 }, tool_calls: 9, success: false, output_valid: false })
    ]

    const summary = buildSummary(rows)

    expect(summary.gate.passed).toBe(false)
    expect(summary.gate.checks.some((check) => check.passed === false)).toBe(true)
  })
})
