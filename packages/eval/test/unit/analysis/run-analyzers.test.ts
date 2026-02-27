import type { Dirent } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}))

// Mock the analyzers from agent-profiler
vi.mock("@ghx-dev/agent-profiler", () => {
  const mockAnalyzer = (name: string) => ({
    name,
    analyze: vi.fn().mockResolvedValue({
      analyzerName: name,
      findings: [],
    }),
  })
  return {
    reasoningAnalyzer: mockAnalyzer("reasoning"),
    strategyAnalyzer: mockAnalyzer("strategy"),
    efficiencyAnalyzer: mockAnalyzer("efficiency"),
    toolPatternAnalyzer: mockAnalyzer("toolPattern"),
    errorAnalyzer: mockAnalyzer("error"),
  }
})

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { runAnalyzers } from "@eval/analysis/run-analyzers.js"

const mockTrace = {
  sessionId: "sess-1",
  events: [],
  turns: [],
  summary: {
    totalTurns: 1,
    totalToolCalls: 2,
    totalTokens: { input: 100, output: 50, reasoning: 0 },
    totalDuration: 1000,
  },
}

afterEach(() => {
  vi.clearAllMocks()
})

describe("runAnalyzers", () => {
  it("discovers trace files and runs analyzers on each", async () => {
    vi.mocked(readdir).mockImplementation(async (path) => {
      const p = String(path)
      if (p.endsWith("sessions")) return ["scenario-001"] as unknown as Dirent[]
      if (p.includes("scenario-001")) return ["ghx-iter-0.json"] as unknown as Dirent[]
      return [] as unknown as Dirent[]
    })
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockTrace))
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)

    const result = await runAnalyzers({
      runDir: "results",
      outputDir: "results/analysis",
    })

    expect(result.length).toBe(1)
    expect(result[0].sessionId).toBe("sess-1")
    expect(result[0].scenarioId).toBe("scenario-001")
    expect(result[0].mode).toBe("ghx")
    expect(result[0].results).toHaveProperty("reasoning")
    expect(result[0].results).toHaveProperty("strategy")
    expect(result[0].results).toHaveProperty("efficiency")
    expect(result[0].results).toHaveProperty("toolPattern")
    expect(result[0].results).toHaveProperty("error")
    expect(writeFile).toHaveBeenCalled()
  })

  it("returns empty array when no sessions directory exists", async () => {
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

    const result = await runAnalyzers({ runDir: "missing", outputDir: "out" })
    expect(result).toEqual([])
  })

  it("parses mode from trace filename", async () => {
    vi.mocked(readdir).mockImplementation(async (path) => {
      const p = String(path)
      if (p.endsWith("sessions")) return ["sc-001"] as unknown as Dirent[]
      if (p.includes("sc-001")) return ["mcp-iter-2.json"] as unknown as Dirent[]
      return [] as unknown as Dirent[]
    })
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockTrace))
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)

    const result = await runAnalyzers({ runDir: "r", outputDir: "o" })
    expect(result[0].mode).toBe("mcp")
  })

  it("writes analysis bundle to output directory", async () => {
    vi.mocked(readdir).mockImplementation(async (path) => {
      const p = String(path)
      if (p.endsWith("sessions")) return ["sc-001"] as unknown as Dirent[]
      return ["ghx-iter-0.json"] as unknown as Dirent[]
    })
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockTrace))
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)

    await runAnalyzers({ runDir: "results", outputDir: "results/analysis" })

    expect(mkdir).toHaveBeenCalledWith(expect.stringContaining("sc-001"), { recursive: true })
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("ghx-iter-0-analysis.json"),
      expect.any(String),
      "utf-8",
    )
  })

  it("skips scenario dirs that fail to read", async () => {
    vi.mocked(readdir).mockImplementation(async (path) => {
      const p = String(path)
      if (p.endsWith("sessions")) return ["good", "bad"] as unknown as Dirent[]
      if (p.includes("good")) return ["ghx-iter-0.json"] as unknown as Dirent[]
      throw new Error("permission denied")
    })
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockTrace))
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)

    const result = await runAnalyzers({ runDir: "r", outputDir: "o" })
    expect(result.length).toBe(1)
    expect(result[0].scenarioId).toBe("good")
  })
})
