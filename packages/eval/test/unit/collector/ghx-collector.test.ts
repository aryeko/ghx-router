import { GhxCollector } from "@eval/collector/ghx-collector.js"
import type { BaseScenario, PromptResult } from "@ghx-dev/agent-profiler"
import { describe, expect, it } from "vitest"

function makePromptResult(toolCalls: Array<{ name: string }>): PromptResult {
  return {
    text: "done",
    metrics: {
      tokens: {
        input: 100,
        output: 50,
        reasoning: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 150,
        active: 150,
      },
      timing: { wallMs: 1000, segments: [] },
      toolCalls: toolCalls.map((tc) => ({
        name: tc.name,
        category: "unknown",
        success: true,
        durationMs: 100,
      })),
      cost: { totalUsd: 0.01, inputUsd: 0.005, outputUsd: 0.005, reasoningUsd: 0 },
    },
    completionReason: "stop",
  }
}

const dummyScenario: BaseScenario = {
  id: "test-001",
  name: "test",
  description: "test",
  prompt: "test",
  timeoutMs: 60000,
  allowedRetries: 0,
  tags: [],
  extensions: {},
}

describe("GhxCollector", () => {
  const collector = new GhxCollector()

  it("has id 'ghx'", () => {
    expect(collector.id).toBe("ghx")
  })

  it("returns zero counts for empty tool calls", async () => {
    const metrics = await collector.collect(makePromptResult([]), dummyScenario, "ghx", null)
    expect(metrics).toHaveLength(6)
    for (const m of metrics) {
      expect(m.value).toBe(0)
      expect(m.unit).toBe("count")
    }
  })

  it("counts ghx capabilities", async () => {
    const result = makePromptResult([{ name: "ghx.pr.view" }, { name: "ghx.pr.list" }])
    const metrics = await collector.collect(result, dummyScenario, "ghx", null)
    const ghxMetric = metrics.find((m) => m.name === "ghx.capabilities_used")
    expect(ghxMetric?.value).toBe(2)
  })

  it("counts mcp tools", async () => {
    const result = makePromptResult([{ name: "github_pr_view" }])
    const metrics = await collector.collect(result, dummyScenario, "mcp", null)
    const mcpMetric = metrics.find((m) => m.name === "ghx.mcp_tools_invoked")
    expect(mcpMetric?.value).toBe(1)
  })

  it("counts gh CLI commands via bash", async () => {
    const result = makePromptResult([{ name: "bash" }])
    // Note: classifyToolCall only sees the name, not the input from PromptResult.toolCalls
    // gh_cli detection requires input, which ToolCallRecord doesn't have
    // So bash without input → "bash"
    const metrics = await collector.collect(result, dummyScenario, "baseline", null)
    const bashMetric = metrics.find((m) => m.name === "ghx.bash_commands")
    expect(bashMetric?.value).toBe(1)
  })

  it("counts multiple categories independently", async () => {
    const result = makePromptResult([
      { name: "ghx.pr.view" },
      { name: "github_issue_list" },
      { name: "bash" },
      { name: "read_file" },
    ])
    const metrics = await collector.collect(result, dummyScenario, "ghx", null)
    const ghxM = metrics.find((m) => m.name === "ghx.capabilities_used")
    const mcpM = metrics.find((m) => m.name === "ghx.mcp_tools_invoked")
    const bashM = metrics.find((m) => m.name === "ghx.bash_commands")
    const fileM = metrics.find((m) => m.name === "ghx.file_ops")
    expect(ghxM?.value).toBe(1)
    expect(mcpM?.value).toBe(1)
    expect(bashM?.value).toBe(1)
    expect(fileM?.value).toBe(1)
  })
})
