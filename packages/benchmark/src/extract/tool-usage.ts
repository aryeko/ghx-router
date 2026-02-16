import type { SessionMessageEntry, SessionMessagePart } from "../domain/types.js"

function countToolParts(parts: SessionMessagePart[]): { toolCalls: number; apiCalls: number } {
  const toolParts = parts.filter((part) => part.type === "tool")
  const apiCalls = toolParts.filter((part) => {
    const toolName = part.tool?.toLowerCase() ?? ""
    return toolName.includes("api") || toolName.includes("http")
  }).length

  return {
    toolCalls: toolParts.length,
    apiCalls,
  }
}

export function aggregateToolCounts(messages: SessionMessageEntry[]): {
  toolCalls: number
  apiCalls: number
} {
  const allParts = messages.flatMap((entry) => entry.parts ?? [])
  return countToolParts(allParts)
}
