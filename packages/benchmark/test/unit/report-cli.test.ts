import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

async function importReportModule(cwd: string) {
  const previous = process.cwd()
  process.chdir(cwd)
  try {
    vi.resetModules()
    return await import("../../src/cli/report.js")
  } finally {
    process.chdir(previous)
  }
}

describe("report cli", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses args and maps modes from file names", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const report = await importReportModule(root)

    expect(report.parseArgs(["--gate"]).gate).toBe(true)
    expect(report.parseArgs([]).gateProfile).toBe("verify_pr")
    expect(report.parseArgs(["--gate-profile", "verify_release"]).gateProfile).toBe(
      "verify_release",
    )
    expect(report.parseArgs(["--gate-profile=verify_pr"]).gateProfile).toBe("verify_pr")
    expect(
      report.parseArgs(["--expectations-model", "openai/gpt-5.1-codex-mini"]).expectationsModel,
    ).toBe("openai/gpt-5.1-codex-mini")
    expect(
      report.parseArgs(["--expectations-config=config/expectations.json"]).expectationsConfigPath,
    ).toBe("config/expectations.json")
    expect(report.modeFromFilename("x-agent_direct-suite.jsonl")).toBe("agent_direct")
    expect(report.modeFromFilename("x-mcp-suite.jsonl")).toBe("mcp")
    expect(report.modeFromFilename("x-ghx-suite.jsonl")).toBe("ghx")
    expect(report.modeFromFilename("x-unknown.jsonl")).toBeNull()
  })

  it("rejects unknown gate profiles", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const report = await importReportModule(root)

    expect(() => report.parseArgs(["--gate-profile", "invalid"])).toThrow("Unknown gate profile")
    expect(() => report.parseArgs(["--gate-profile"])).toThrow("Unknown gate profile")
  })

  it("parses explicit expectation flags in split form", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const report = await importReportModule(root)
    const parsed = report.parseArgs([
      "--expectations-config",
      "config/custom.json",
      "--expectations-model",
      "openai/gpt-x",
    ])

    expect(parsed.expectationsConfigPath).toBe("config/custom.json")
    expect(parsed.expectationsModel).toBe("openai/gpt-x")
  })

  it("rejects expectation flags without a value", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const report = await importReportModule(root)

    expect(() => report.parseArgs(["--expectations-config"])).toThrow(
      "Missing value for --expectations-config",
    )
    expect(() => report.parseArgs(["--expectations-config="])).toThrow(
      "Missing value for --expectations-config",
    )
    expect(() => report.parseArgs(["--expectations-config", "--gate"])).toThrow(
      "Missing value for --expectations-config",
    )

    expect(() => report.parseArgs(["--expectations-model"])).toThrow(
      "Missing value for --expectations-model",
    )
    expect(() => report.parseArgs(["--expectations-model="])).toThrow(
      "Missing value for --expectations-model",
    )
    expect(() => report.parseArgs(["--expectations-model", "--gate"])).toThrow(
      "Missing value for --expectations-model",
    )
  })

  it("loads latest rows and writes report outputs", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const results = join(root, "results")
    await mkdir(results, { recursive: true })

    const row = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r1",
      mode: "agent_direct",
      scenario_id: "s1",
      scenario_set: null,
      iteration: 1,
      session_id: "ss",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "x", model_id: "y", mode: null },
      git: { repo: null, commit: null },
      error: null,
    })

    await writeFile(join(results, "2026-01-01-agent_direct-suite.jsonl"), `${row}\n`, "utf8")
    await writeFile(
      join(results, "2026-01-02-ghx-suite.jsonl"),
      `${row.replace("agent_direct", "ghx")}\n`,
      "utf8",
    )

    const report = await importReportModule(root)
    const rows = await report.loadLatestRowsPerMode()
    expect(rows).toHaveLength(2)

    const previous = process.cwd()
    process.chdir(root)
    try {
      await report.main([])
    } finally {
      process.chdir(previous)
    }
  })

  it("fails gate when summary does not pass", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const results = join(root, "results")
    await mkdir(results, { recursive: true })

    const row = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r1",
      mode: "agent_direct",
      scenario_id: "s1",
      scenario_set: null,
      iteration: 1,
      session_id: "ss",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "x", model_id: "y", mode: null },
      git: { repo: null, commit: null },
      error: null,
    })
    await writeFile(join(results, "2026-01-01-agent_direct-suite.jsonl"), `${row}\n`, "utf8")

    const report = await importReportModule(root)
    const previous = process.cwd()
    process.chdir(root)
    try {
      await expect(report.main(["--gate"])).rejects.toThrow("Benchmark gate failed")
    } finally {
      process.chdir(previous)
    }
  })

  it("fails when no benchmark rows exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    await mkdir(join(root, "results"), { recursive: true })
    const report = await importReportModule(root)

    const previous = process.cwd()
    process.chdir(root)
    try {
      await expect(report.main([])).rejects.toThrow("No benchmark result rows found")
    } finally {
      process.chdir(previous)
    }
  })

  it("loads thresholds from expectations config when present", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const results = join(root, "results")
    const configDir = join(root, "config")
    await mkdir(results, { recursive: true })
    await mkdir(configDir, { recursive: true })

    const row = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r1",
      mode: "agent_direct",
      scenario_id: "s1",
      scenario_set: null,
      iteration: 1,
      session_id: "ss",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini", mode: null },
      git: { repo: null, commit: null },
      error: null,
    })
    await writeFile(join(results, "2026-01-01-agent_direct-suite.jsonl"), `${row}\n`, "utf8")
    await writeFile(
      join(results, "2026-01-02-ghx-suite.jsonl"),
      `${row.replace("agent_direct", "ghx")}\n`,
      "utf8",
    )
    await writeFile(
      join(configDir, "expectations.json"),
      JSON.stringify({
        default_model: "openai/gpt-5.1-codex-mini",
        expectations: {
          "openai/gpt-5.1-codex-mini": {
            verify_pr: {
              minTokensActiveReductionPct: -100,
              minLatencyReductionPct: -100,
              minToolCallReductionPct: -100,
              minEfficiencyCoveragePct: 0,
              maxSuccessRateDropPct: 100,
              minOutputValidityRatePct: 0,
              maxRunnerFailureRatePct: 100,
              maxTimeoutStallRatePct: 100,
              maxRetryRatePct: 100,
              minSamplesPerScenarioPerMode: 1,
            },
            verify_release: {
              minTokensActiveReductionPct: -100,
              minLatencyReductionPct: -100,
              minToolCallReductionPct: -100,
              minEfficiencyCoveragePct: 0,
              maxSuccessRateDropPct: 100,
              minOutputValidityRatePct: 0,
              maxRunnerFailureRatePct: 100,
              maxTimeoutStallRatePct: 100,
              maxRetryRatePct: 100,
              minSamplesPerScenarioPerMode: 1,
            },
          },
        },
      }),
      "utf8",
    )

    const report = await importReportModule(root)
    const previous = process.cwd()
    process.chdir(root)
    try {
      await expect(report.main(["--gate"])).resolves.toBeUndefined()
    } finally {
      process.chdir(previous)
    }
  })

  it("fails when expectations model is provided without config file", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const results = join(root, "results")
    await mkdir(results, { recursive: true })

    const row = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r1",
      mode: "agent_direct",
      scenario_id: "s1",
      scenario_set: null,
      iteration: 1,
      session_id: "ss",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini", mode: null },
      git: { repo: null, commit: null },
      error: null,
    })

    await writeFile(join(results, "2026-01-01-agent_direct-suite.jsonl"), `${row}\n`, "utf8")
    await writeFile(
      join(results, "2026-01-02-ghx-suite.jsonl"),
      `${row.replace("agent_direct", "ghx")}\n`,
      "utf8",
    )

    const report = await importReportModule(root)
    const previous = process.cwd()
    process.chdir(root)
    try {
      await expect(
        report.main(["--expectations-model", "openai/gpt-5.1-codex-mini"]),
      ).rejects.toThrow("Expectations config not found")
    } finally {
      process.chdir(previous)
    }
  })

  it("fails when an explicit expectations config path does not exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const results = join(root, "results")
    await mkdir(results, { recursive: true })

    const row = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r1",
      mode: "agent_direct",
      scenario_id: "s1",
      scenario_set: null,
      iteration: 1,
      session_id: "ss",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "openai", model_id: "gpt-5.1-codex-mini", mode: null },
      git: { repo: null, commit: null },
      error: null,
    })

    await writeFile(join(results, "2026-01-01-agent_direct-suite.jsonl"), `${row}\n`, "utf8")
    await writeFile(
      join(results, "2026-01-02-ghx-suite.jsonl"),
      `${row.replace("agent_direct", "ghx")}\n`,
      "utf8",
    )

    const report = await importReportModule(root)
    const previous = process.cwd()
    process.chdir(root)
    try {
      await expect(report.main(["--expectations-config", "config/missing.json"])).rejects.toThrow(
        "Expectations config not found",
      )
    } finally {
      process.chdir(previous)
    }
  })

  it("rejects mixed latest cohorts across modes", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const results = join(root, "results")
    await mkdir(results, { recursive: true })

    const agentRow = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r-agent",
      mode: "agent_direct",
      scenario_id: "s1",
      scenario_set: "pr-exec",
      iteration: 1,
      session_id: "ss-agent",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "x", model_id: "y", mode: null },
      git: { repo: "ghx", commit: "abc123" },
      error: null,
    })

    const ghxRow = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r-ghx",
      mode: "ghx",
      scenario_id: "s2",
      scenario_set: "default",
      iteration: 1,
      session_id: "ss-ghx",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "x", model_id: "y", mode: null },
      git: { repo: "ghx", commit: "def456" },
      error: null,
    })

    await writeFile(join(results, "2026-01-03-agent_direct-suite.jsonl"), `${agentRow}\n`, "utf8")
    await writeFile(join(results, "2026-01-04-ghx-suite.jsonl"), `${ghxRow}\n`, "utf8")

    const report = await importReportModule(root)
    await expect(report.loadLatestRowsPerMode()).rejects.toThrow("not comparable across modes")
  })

  it("allows git commit mismatch checks to be skipped when either side is null", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const results = join(root, "results")
    await mkdir(results, { recursive: true })

    const agentRow = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r-agent",
      mode: "agent_direct",
      scenario_id: "s1",
      scenario_set: null,
      iteration: 1,
      session_id: "ss-agent",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "x", model_id: "y", mode: null },
      git: { repo: "ghx", commit: null },
      error: null,
    })

    const ghxRow = JSON.stringify({
      timestamp: "2026-02-13T00:00:00.000Z",
      run_id: "r-ghx",
      mode: "ghx",
      scenario_id: "s1",
      scenario_set: null,
      iteration: 1,
      session_id: "ss-ghx",
      success: true,
      output_valid: true,
      latency_ms_wall: 100,
      sdk_latency_ms: 90,
      tokens: { input: 1, output: 1, reasoning: 1, cache_read: 0, cache_write: 0, total: 3 },
      cost: 0,
      tool_calls: 1,
      api_calls: 1,
      internal_retry_count: 0,
      external_retry_count: 0,
      model: { provider_id: "x", model_id: "y", mode: null },
      git: { repo: "ghx", commit: "def456" },
      error: null,
    })

    await writeFile(join(results, "2026-01-03-agent_direct-suite.jsonl"), `${agentRow}\n`, "utf8")
    await writeFile(join(results, "2026-01-04-ghx-suite.jsonl"), `${ghxRow}\n`, "utf8")

    const report = await importReportModule(root)
    await expect(report.loadLatestRowsPerMode()).resolves.toHaveLength(2)
  })
})
