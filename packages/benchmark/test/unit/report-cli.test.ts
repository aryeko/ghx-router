import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

async function importReportModule(cwd: string) {
  const previous = process.cwd()
  process.chdir(cwd)
  vi.resetModules()
  const mod = await import("../../src/cli/report.js")
  process.chdir(previous)
  return mod
}

describe("report cli", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("parses args and maps modes from file names", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-report-"))
    const report = await importReportModule(root)

    expect(report.parseArgs(["--gate"]).gate).toBe(true)
    expect(report.modeFromFilename("x-agent_direct-suite.jsonl")).toBe("agent_direct")
    expect(report.modeFromFilename("x-mcp-suite.jsonl")).toBe("mcp")
    expect(report.modeFromFilename("x-ghx_router-suite.jsonl")).toBe("ghx_router")
    expect(report.modeFromFilename("x-unknown.jsonl")).toBeNull()
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
      error: null
    })

    await writeFile(join(results, "2026-01-01-agent_direct-suite.jsonl"), `${row}\n`, "utf8")
    await writeFile(join(results, "2026-01-02-ghx_router-suite.jsonl"), `${row.replace('agent_direct', 'ghx_router')}\n`, "utf8")

    const report = await importReportModule(root)
    const rows = await report.loadLatestRowsPerMode()
    expect(rows).toHaveLength(2)

    const previous = process.cwd()
    process.chdir(root)
    await report.main([])
    process.chdir(previous)
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
      error: null
    })
    await writeFile(join(results, "2026-01-01-agent_direct-suite.jsonl"), `${row}\n`, "utf8")

    const report = await importReportModule(root)
    const previous = process.cwd()
    process.chdir(root)
    await expect(report.main(["--gate"]))
      .rejects.toThrow("Benchmark gate failed")
    process.chdir(previous)
  })
})
