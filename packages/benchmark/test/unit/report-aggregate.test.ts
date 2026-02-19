import type { BenchmarkRow } from "@bench/domain/types.js"
import { buildSummary, toMarkdown } from "@bench/report/aggregate.js"
import { describe, expect, it } from "vitest"

function row(overrides: Partial<BenchmarkRow>): BenchmarkRow {
  return {
    timestamp: "2026-02-13T00:00:00.000Z",
    run_id: "run",
    mode: "agent_direct",
    scenario_id: "repo-view-001",
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
    cost: 0,
    tool_calls: 4,
    api_calls: 2,
    internal_retry_count: 0,
    external_retry_count: 0,
    model: {
      provider_id: "openai",
      model_id: "gpt-5.3-codex",
      mode: null,
    },
    git: {
      repo: "aryeko/ghx",
      commit: "abc",
    },
    error: null,
    ...overrides,
  }
}

describe("buildSummary", () => {
  it("computes v2 gate pass when ghx beats baseline", () => {
    const rows: BenchmarkRow[] = [
      row({
        mode: "agent_direct",
        latency_ms_wall: 100,
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 100 },
        tool_calls: 10,
        cost: 0.1,
        success: true,
        output_valid: true,
      }),
      row({
        mode: "ghx",
        latency_ms_wall: 70,
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 70 },
        tool_calls: 6,
        cost: 0.08,
        success: true,
        output_valid: true,
      }),
    ]

    const summary = buildSummary(rows)

    expect(summary.deltaVsAgentDirect).not.toBeNull()
    expect(summary.gateV2.passed).toBe(true)
    expect(
      summary.gateV2.checks.find((check) => check.name === "efficiency_tokens_active_reduction")
        ?.passed,
    ).toBe(true)
  })

  it("computes v2 gate fail when reliability regresses", () => {
    const rows: BenchmarkRow[] = [
      row({
        mode: "agent_direct",
        latency_ms_wall: 100,
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 100 },
        tool_calls: 10,
        success: true,
        output_valid: true,
      }),
      row({
        mode: "ghx",
        latency_ms_wall: 70,
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 70 },
        tool_calls: 6,
        success: true,
        output_valid: true,
      }),
      row({
        mode: "ghx",
        scenario_id: "repo-view-001",
        success: false,
        output_valid: false,
        latency_ms_wall: 60000,
        error: {
          type: "runner_error",
          message: "Timed out waiting for assistant message in session.messages",
        },
      }),
    ]

    const summary = buildSummary(rows)

    expect(summary.gateV2.passed).toBe(false)
    expect(
      summary.gateV2.checks.find((check) => check.name === "reliability_runner_failure_rate")
        ?.passed,
    ).toBe(false)
    expect(
      summary.gateV2.checks.find((check) => check.name === "reliability_timeout_stall_rate")
        ?.passed,
    ).toBe(false)
  })

  it("handles missing comparison mode and renders markdown", () => {
    const summary = buildSummary([row({ mode: "mcp", latency_ms_wall: 120, tool_calls: 2 })])

    expect(summary.deltaVsAgentDirect).toBeNull()
    const markdown = toMarkdown(summary)
    expect(markdown).toContain("Insufficient data")
  })

  it("omits legacy v1 gate data from summary and markdown", () => {
    const summary = buildSummary([
      row({
        mode: "agent_direct",
        latency_ms_wall: 100,
        tool_calls: 10,
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 100 },
      }),
      row({
        mode: "ghx",
        latency_ms_wall: 90,
        tool_calls: 8,
        tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 95 },
      }),
    ])

    expect(summary).not.toHaveProperty("gate")

    const markdown = toMarkdown(summary)
    expect(markdown).not.toContain("Legacy Gate (v1)")
    expect(markdown).not.toContain("tokens_reduction")
  })

  it("supports verify_release profile with stricter sample requirements", () => {
    const summary = buildSummary(
      [
        row({
          mode: "agent_direct",
          scenario_id: "s1",
          latency_ms_wall: 100,
          tool_calls: 5,
          tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 100 },
        }),
        row({
          mode: "ghx",
          scenario_id: "s1",
          latency_ms_wall: 70,
          tool_calls: 3,
          tokens: { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 70 },
        }),
      ],
      "verify_release",
    )

    expect(summary.gateV2.profile).toBe("verify_release")
    expect(
      summary.gateV2.checks.find((check) => check.name === "efficiency_coverage")?.passed,
    ).toBe(false)
  })

  it("summarizes profiling timing when timing_breakdown is present", () => {
    const summary = buildSummary([
      row({
        mode: "agent_direct",
        timing_breakdown: {
          assistant_total_ms: 6000,
          assistant_pre_reasoning_ms: 2500,
          assistant_reasoning_ms: 2000,
          assistant_between_reasoning_and_tool_ms: 200,
          assistant_post_tool_ms: 100,
          tool_total_ms: 700,
          tool_bash_ms: 650,
          tool_structured_output_ms: 2,
          observed_assistant_turns: 2,
        },
      }),
      row({
        mode: "ghx",
        timing_breakdown: {
          assistant_total_ms: 9000,
          assistant_pre_reasoning_ms: 4000,
          assistant_reasoning_ms: 2800,
          assistant_between_reasoning_and_tool_ms: 300,
          assistant_post_tool_ms: 100,
          tool_total_ms: 1600,
          tool_bash_ms: 1500,
          tool_structured_output_ms: 1,
          observed_assistant_turns: 2,
        },
      }),
    ])

    expect(summary.profiling.agent_direct?.medianToolBashMs).toBe(650)
    expect(summary.profiling.ghx?.medianAssistantReasoningMs).toBe(2800)

    const markdown = toMarkdown(summary)
    expect(markdown).toContain("## Profiling Snapshot")
    expect(markdown).toContain("| ghx | 1 | 9000 | 2800")
  })

  it("uses provided timestamp instead of current time", () => {
    const rows = [row({ mode: "agent_direct" })]
    const summary = buildSummary(rows, "verify_pr", undefined, "2026-01-01T00:00:00.000Z")
    expect(summary.generatedAt).toBe("2026-01-01T00:00:00.000Z")
  })

  it("computes median for even-length arrays", () => {
    const rows = [
      row({ mode: "agent_direct", latency_ms_wall: 100 }),
      row({ mode: "agent_direct", latency_ms_wall: 200 }),
      row({ mode: "agent_direct", latency_ms_wall: 300 }),
      row({ mode: "agent_direct", latency_ms_wall: 400 }),
    ]
    const summary = buildSummary(rows)
    expect(summary.modes.agent_direct?.medianLatencyMs).toBe(250)
  })

  it("produces valid markdown table structure", () => {
    const rows = [
      row({ mode: "agent_direct", latency_ms_wall: 100, tool_calls: 5 }),
      row({ mode: "ghx", latency_ms_wall: 80, tool_calls: 3 }),
    ]
    const summary = buildSummary(rows)
    const md = toMarkdown(summary)
    expect(md).toContain("| Mode |")
    expect(md).toContain("|---|")
    expect(md.split("\n").filter((line) => line.startsWith("|")).length).toBeGreaterThan(5)
  })
})
