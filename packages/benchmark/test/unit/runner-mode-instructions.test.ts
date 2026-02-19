import {
  AGENT_DIRECT_INSTRUCTION,
  MCP_INSTRUCTION,
  modeInstructions,
} from "@bench/runner/mode/mode-instructions.js"
import { describe, expect, it, vi } from "vitest"

describe("modeInstructions", () => {
  it("loads ghx skill content for ghx mode", async () => {
    const load = vi.fn(async () => "# ghx CLI Skill")

    const result = await modeInstructions("ghx", load)

    expect(load).toHaveBeenCalledTimes(1)
    expect(result).toEqual(["# ghx CLI Skill"])
  })

  it("returns static instructions for non-ghx modes", async () => {
    const load = vi.fn(async () => "ignored")

    const agentDirect = await modeInstructions("agent_direct", load)
    const mcp = await modeInstructions("mcp", load)

    expect(load).not.toHaveBeenCalled()
    expect(agentDirect).toEqual([AGENT_DIRECT_INSTRUCTION])
    expect(mcp).toEqual([MCP_INSTRUCTION])
  })
})
