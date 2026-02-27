import { exportCsv } from "@profiler/reporter/csv-exporter.js"
import { describe, expect, it } from "vitest"
import { makeProfileRow } from "./_make-profile-row.js"

describe("exportCsv", () => {
  it("produces correct header line", () => {
    const result = exportCsv([])
    const firstLine = result.split("\n")[0] ?? ""
    expect(firstLine).toBe(
      "run_id,scenario_id,mode,model,iteration,success,timing_wall_ms," +
        "tokens_input,tokens_output,tokens_reasoning,tokens_cache_read," +
        "tokens_cache_write,tokens_total,tokens_active,tool_calls_total," +
        "tool_calls_failed,tool_calls_error_rate,cost_total_usd,cost_input_usd," +
        "cost_output_usd,cost_reasoning_usd,checkpoints_passed,checkpoints_total," +
        "output_valid,provider,session_id,agent_turns,completion_reason",
    )
  })

  it("produces correct number of data rows", () => {
    const rows = [makeProfileRow(), makeProfileRow(), makeProfileRow()]
    const result = exportCsv(rows)
    const lines = result.split("\n")
    // 1 header + 3 data rows
    expect(lines.length).toBe(4)
  })

  it("contains expected field values", () => {
    const row = makeProfileRow({
      runId: "run_csv",
      scenarioId: "scen_1",
      mode: "turbo",
      model: "gpt-5",
    })
    const result = exportCsv([row])
    const dataLine = result.split("\n")[1] ?? ""
    expect(dataLine).toContain("run_csv")
    expect(dataLine).toContain("scen_1")
    expect(dataLine).toContain("turbo")
    expect(dataLine).toContain("gpt-5")
  })

  it("escapes fields containing commas", () => {
    const row = makeProfileRow({ model: "model,with,commas" })
    const result = exportCsv([row])
    expect(result).toContain('"model,with,commas"')
  })

  it("maps boolean success to string", () => {
    const row = makeProfileRow({ success: true })
    const result = exportCsv([row])
    const dataLine = result.split("\n")[1] ?? ""
    expect(dataLine).toContain("true")
  })

  it("includes all token breakdown fields", () => {
    const row = makeProfileRow({
      tokens: {
        input: 111,
        output: 222,
        reasoning: 333,
        cacheRead: 44,
        cacheWrite: 55,
        total: 666,
        active: 600,
      },
    })
    const result = exportCsv([row])
    const dataLine = result.split("\n")[1] ?? ""
    expect(dataLine).toContain("111")
    expect(dataLine).toContain("222")
    expect(dataLine).toContain("333")
    expect(dataLine).toContain("44")
    expect(dataLine).toContain("55")
    expect(dataLine).toContain("666")
    expect(dataLine).toContain("600")
  })
})
