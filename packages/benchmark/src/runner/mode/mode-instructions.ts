import type { BenchmarkMode } from "../../domain/types.js"

export const AGENT_DIRECT_INSTRUCTION =
  "You are running a benchmark in agent_direct mode. Use GitHub CLI (`gh`) commands directly to complete the task. Do not use `ghx`."

export const MCP_INSTRUCTION =
  "You are running a benchmark in mcp mode. Prefer MCP tools when available."

export async function modeInstructions(
  mode: BenchmarkMode,
  loadGhxSkillInstruction: () => Promise<string>,
): Promise<string[]> {
  if (mode === "ghx") {
    const ghxSkillInstruction = await loadGhxSkillInstruction()
    return [ghxSkillInstruction]
  }

  if (mode === "agent_direct") {
    return [AGENT_DIRECT_INSTRUCTION]
  }

  return [MCP_INSTRUCTION]
}
