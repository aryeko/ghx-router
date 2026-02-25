import { analyzeGhxLogs, analyzeSession, readRunDir } from "@bench/report/iter-reader.js"
import { describe, expect, it, vi } from "vitest"

const readdirMock = vi.hoisted(() => vi.fn())
const readFileMock = vi.hoisted(() => vi.fn())
const readJsonlFileMock = vi.hoisted(() => vi.fn())

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    readdir: readdirMock,
    readFile: readFileMock,
  }
})

vi.mock("@bench/util/jsonl.js", () => ({ readJsonlFile: readJsonlFileMock }))

/** Make readFile return non-JSON content so analyzeSession falls through to readJsonlFile. */
function mockReadFileAsJsonl(): void {
  readFileMock.mockResolvedValueOnce("not-valid-json-for-whole-doc")
}

describe("analyzeSession", () => {
  it("returns null when readFile throws", async () => {
    readFileMock.mockRejectedValueOnce(new Error("ENOENT"))

    const result = await analyzeSession("/run/iter-1")

    expect(result).toBeNull()
  })

  it("parses new JSON document format with messages[].parts[]", async () => {
    readFileMock.mockResolvedValueOnce(
      JSON.stringify({
        info: {},
        messages: [
          {
            parts: [
              { type: "tool", state: { input: { command: "gh issue list" } } },
              { type: "text" },
            ],
          },
          {
            parts: [
              { type: "reasoning" },
              {
                type: "step-finish",
                tokens: {
                  input: 100,
                  output: 50,
                  reasoning: 20,
                  cache: { read: 10, write: 5 },
                  total: 185,
                },
              },
            ],
          },
        ],
      }),
    )

    const result = await analyzeSession("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.toolCallCount).toBe(1)
    expect(result?.toolCallCommands).toEqual(["gh issue list"])
    expect(result?.assistantTurns).toBe(1)
    expect(result?.reasoningBlocks).toBe(1)
    expect(result?.tokens).toEqual({
      input: 100,
      output: 50,
      reasoning: 20,
      cache_read: 10,
      cache_write: 5,
      total: 185,
    })
  })

  it("counts tool calls and extracts commands from type=tool entries", async () => {
    mockReadFileAsJsonl()
    readJsonlFileMock.mockResolvedValueOnce([
      { type: "tool", state: { input: { command: "gh issue list" } } },
      { type: "tool", state: { input: { command: "gh pr create" } } },
      { type: "tool", state: { input: {} } },
    ])

    const result = await analyzeSession("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.toolCallCount).toBe(3)
    expect(result?.toolCallCommands).toEqual(["gh issue list", "gh pr create", ""])
  })

  it("counts assistant turns from type=text entries", async () => {
    mockReadFileAsJsonl()
    readJsonlFileMock.mockResolvedValueOnce([
      { type: "text" },
      { type: "text" },
      { type: "tool", state: { input: { command: "ls" } } },
    ])

    const result = await analyzeSession("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.assistantTurns).toBe(2)
  })

  it("counts reasoning blocks from type=reasoning entries", async () => {
    mockReadFileAsJsonl()
    readJsonlFileMock.mockResolvedValueOnce([
      { type: "reasoning" },
      { type: "reasoning" },
      { type: "reasoning" },
      { type: "text" },
    ])

    const result = await analyzeSession("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.reasoningBlocks).toBe(3)
  })

  it("accumulates tokens from type=step-finish entries", async () => {
    mockReadFileAsJsonl()
    readJsonlFileMock.mockResolvedValueOnce([
      {
        type: "step-finish",
        tokens: {
          input: 100,
          output: 50,
          reasoning: 20,
          cache_read: 10,
          cache_write: 5,
          total: 185,
        },
      },
      {
        type: "step-finish",
        tokens: {
          input: 200,
          output: 80,
          reasoning: 30,
          cache_read: 15,
          cache_write: 10,
          total: 335,
        },
      },
    ])

    const result = await analyzeSession("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.tokens).toEqual({
      input: 300,
      output: 130,
      reasoning: 50,
      cache_read: 25,
      cache_write: 15,
      total: 520,
    })
  })

  it("normalizes cache fields from nested cache.{read,write}", async () => {
    mockReadFileAsJsonl()
    readJsonlFileMock.mockResolvedValueOnce([
      {
        type: "step-finish",
        tokens: { input: 50, output: 20, reasoning: 0, cache: { read: 8, write: 3 }, total: 81 },
      },
    ])

    const result = await analyzeSession("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.tokens?.cache_read).toBe(8)
    expect(result?.tokens?.cache_write).toBe(3)
  })

  it("returns null tokens when no step-finish entries", async () => {
    mockReadFileAsJsonl()
    readJsonlFileMock.mockResolvedValueOnce([
      { type: "text" },
      { type: "tool", state: { input: { command: "ls" } } },
    ])

    const result = await analyzeSession("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.tokens).toBeNull()
  })
})

describe("analyzeGhxLogs", () => {
  it("returns null when readdir throws", async () => {
    readdirMock.mockRejectedValueOnce(new Error("ENOENT"))

    const result = await analyzeGhxLogs("/run/iter-1")

    expect(result).toBeNull()
  })

  it("returns null when no ghx-*.jsonl files in dir", async () => {
    readdirMock.mockResolvedValueOnce(["session.jsonl", "output.json"])

    const result = await analyzeGhxLogs("/run/iter-1")

    expect(result).toBeNull()
  })

  it("extracts capabilities and routes from execute.complete and route.plan entries", async () => {
    readdirMock.mockResolvedValueOnce(["ghx-run.jsonl"])
    readJsonlFileMock.mockResolvedValueOnce([
      { msg: "route.plan", capability_id: "issues.list", route: "graphql" },
      { msg: "execute.complete", capability_id: "issues.list", ok: true },
      { msg: "route.plan", capability_id: "pr.create", route: "cli" },
      { msg: "execute.complete", capability_id: "pr.create", ok: true },
    ])

    const result = await analyzeGhxLogs("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.capabilities).toEqual([
      { capability_id: "issues.list", route: "graphql", ok: true },
      { capability_id: "pr.create", route: "cli", ok: true },
    ])
    expect(result?.errorCount).toBe(0)
  })

  it("counts errors when ok=false on execute.complete", async () => {
    readdirMock.mockResolvedValueOnce(["ghx-run.jsonl"])
    readJsonlFileMock.mockResolvedValueOnce([
      { msg: "route.plan", capability_id: "issues.list", route: "cli" },
      { msg: "execute.complete", capability_id: "issues.list", ok: false },
      { msg: "execute.complete", capability_id: "pr.view", ok: false },
    ])

    const result = await analyzeGhxLogs("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.errorCount).toBe(2)
    expect(result?.capabilities[0]?.ok).toBe(false)
  })

  it("skips ghx log files that throw on read and continues to next", async () => {
    readdirMock.mockResolvedValueOnce(["ghx-run1.jsonl", "ghx-run2.jsonl"])
    // First file throws
    readJsonlFileMock.mockRejectedValueOnce(new Error("ENOENT"))
    // Second file has valid entries
    readJsonlFileMock.mockResolvedValueOnce([
      { msg: "execute.complete", capability_id: "pr.list", ok: true },
    ])

    const result = await analyzeGhxLogs("/run/iter-1")

    expect(result).not.toBeNull()
    expect(result?.capabilities).toHaveLength(1)
    expect(result?.capabilities[0]?.capability_id).toBe("pr.list")
  })
})

describe("readRunDir", () => {
  it("returns empty array when readdir throws", async () => {
    readdirMock.mockRejectedValueOnce(new Error("ENOENT"))

    const result = await readRunDir("/nonexistent")

    expect(result).toEqual([])
  })

  it("scans mode/scenario/iter-N structure and returns correct IterData", async () => {
    // readdir for runDir (modes)
    readdirMock.mockResolvedValueOnce(["ghx"])
    // readdir for modeDir (scenarios)
    readdirMock.mockResolvedValueOnce(["pr-fix-001"])
    // readdir for scenarioDir (iters)
    readdirMock.mockResolvedValueOnce(["iter-1", "iter-2", "not-iter"])
    // analyzeSession calls readFile for iter-1
    mockReadFileAsJsonl()
    readJsonlFileMock.mockResolvedValueOnce([{ type: "text" }])
    // analyzeGhxLogs readdir for iter-1
    readdirMock.mockResolvedValueOnce([])
    // analyzeSession for iter-2
    mockReadFileAsJsonl()
    readJsonlFileMock.mockResolvedValueOnce([])
    // analyzeGhxLogs readdir for iter-2
    readdirMock.mockResolvedValueOnce(["ghx-run.jsonl"])
    readJsonlFileMock.mockResolvedValueOnce([
      { msg: "execute.complete", capability_id: "pr.list", ok: true },
    ])

    const result = await readRunDir("/runs/my-run")

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({
      mode: "ghx",
      scenarioId: "pr-fix-001",
      iteration: 1,
    })
    expect(result[1]).toMatchObject({
      mode: "ghx",
      scenarioId: "pr-fix-001",
      iteration: 2,
    })
  })

  it("skips modes where readdir(modeDir) throws", async () => {
    // readdir for runDir (modes)
    readdirMock.mockResolvedValueOnce(["ghx", "agent_direct"])
    // readdir for ghx modeDir — throws
    readdirMock.mockRejectedValueOnce(new Error("ENOENT"))
    // readdir for agent_direct modeDir — returns scenarios
    readdirMock.mockResolvedValueOnce(["sc-001"])
    // readdir for scenarioDir
    readdirMock.mockResolvedValueOnce(["iter-1"])
    // analyzeSession: readFile for iter-1
    readFileMock.mockRejectedValueOnce(new Error("ENOENT"))
    // analyzeGhxLogs readdir for iter-1
    readdirMock.mockResolvedValueOnce([])

    const result = await readRunDir("/runs/my-run")

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ mode: "agent_direct", scenarioId: "sc-001", iteration: 1 })
  })

  it("skips scenarios where readdir(scenarioDir) throws", async () => {
    // readdir for runDir (modes)
    readdirMock.mockResolvedValueOnce(["ghx"])
    // readdir for modeDir (scenarios)
    readdirMock.mockResolvedValueOnce(["sc-fail", "sc-ok"])
    // readdir for sc-fail scenarioDir — throws
    readdirMock.mockRejectedValueOnce(new Error("ENOENT"))
    // readdir for sc-ok scenarioDir
    readdirMock.mockResolvedValueOnce(["iter-1"])
    // analyzeSession: readFile for iter-1
    readFileMock.mockRejectedValueOnce(new Error("ENOENT"))
    // analyzeGhxLogs readdir for iter-1
    readdirMock.mockResolvedValueOnce([])

    const result = await readRunDir("/runs/my-run")

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ scenarioId: "sc-ok", iteration: 1 })
  })

  it("skips iter entries that do not match iter-N pattern", async () => {
    readdirMock.mockResolvedValueOnce(["ghx"])
    readdirMock.mockResolvedValueOnce(["sc-001"])
    readdirMock.mockResolvedValueOnce(["iter-1", "not-an-iter", "_ghx"])
    // analyzeSession for iter-1
    readFileMock.mockRejectedValueOnce(new Error("ENOENT"))
    // analyzeGhxLogs for iter-1
    readdirMock.mockResolvedValueOnce([])

    const result = await readRunDir("/runs/my-run")

    // Only iter-1 should be included, not "not-an-iter" or "_ghx"
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ iteration: 1 })
  })
})
