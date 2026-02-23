import {
  AGENT_DIRECT_INSTRUCTION,
  MCP_INSTRUCTION,
  modeInstructions,
} from "@bench/runner/mode-instructions.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

describe("modeInstructions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns AGENT_DIRECT_INSTRUCTION for agent_direct mode without calling loader", async () => {
    const loader = vi.fn()
    const result = await modeInstructions("agent_direct", loader)

    expect(result).toEqual([AGENT_DIRECT_INSTRUCTION])
    expect(loader).not.toHaveBeenCalled()
  })

  it("returns MCP_INSTRUCTION for mcp mode without calling loader", async () => {
    const loader = vi.fn()
    const result = await modeInstructions("mcp", loader)

    expect(result).toEqual([MCP_INSTRUCTION])
    expect(loader).not.toHaveBeenCalled()
  })

  it("calls loadGhxSkillInstruction for ghx mode and returns its result wrapped in array", async () => {
    const ghxInstruction = "Use the ghx tool to complete the task."
    const loader = vi.fn().mockResolvedValue(ghxInstruction)
    const result = await modeInstructions("ghx", loader)

    expect(result).toEqual([ghxInstruction])
    expect(loader).toHaveBeenCalledOnce()
  })

  it("returns the exact instruction for agent_direct mode", () => {
    expect(AGENT_DIRECT_INSTRUCTION).toBe(
      "Use GitHub CLI (`gh`) commands directly to complete the task.",
    )
  })

  it("returns the exact instruction for mcp mode", () => {
    expect(MCP_INSTRUCTION).toBe(
      "You are running a benchmark in mcp mode. Prefer MCP tools when available.",
    )
  })
})
