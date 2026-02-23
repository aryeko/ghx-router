import type { BenchmarkRow, ModeSummary } from "@bench/domain/types.js"

export function makeRow(overrides: Partial<BenchmarkRow> = {}): BenchmarkRow {
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
    latency_ms_agent: 70,
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

export function makeModeSummary(overrides: Partial<ModeSummary> = {}): ModeSummary {
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
    medianLatencyMsWall: 70,
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
