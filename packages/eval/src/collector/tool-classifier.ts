export type ToolCategory = "ghx" | "mcp" | "gh_cli" | "bash" | "file_ops" | "other"

/**
 * Classify a tool call into a category based on its name and input.
 * Used by GhxCollector to count tool usage by category.
 */
export function classifyToolCall(name: string, input?: unknown): ToolCategory {
  // ghx tool calls: starts with "ghx" or contains "ghx run"
  if (name === "ghx" || name.startsWith("ghx.") || name.startsWith("ghx_")) {
    return "ghx"
  }

  // MCP tool calls from GitHub MCP server
  if (name.startsWith("github_") || name.startsWith("mcp_") || name.startsWith("mcp__")) {
    return "mcp"
  }

  // File operations
  if (isFileOp(name)) {
    return "file_ops"
  }

  // Bash/shell with gh CLI command
  if (isBashTool(name)) {
    if (isGhCliCommand(input)) {
      return "gh_cli"
    }
    return "bash"
  }

  return "other"
}

function isFileOp(name: string): boolean {
  const fileOpTools = [
    "read_file",
    "write_file",
    "edit_file",
    "list_files",
    "list_directory",
    "create_file",
    "delete_file",
    "view_file",
    "Read",
    "Write",
    "Edit",
    "Glob",
  ]
  return fileOpTools.includes(name)
}

function isBashTool(name: string): boolean {
  return ["bash", "shell", "terminal", "Bash", "run_terminal_cmd", "computer"].includes(name)
}

function isGhCliCommand(input: unknown): boolean {
  if (input === null || typeof input !== "object") return false
  const inp = input as Record<string, unknown>
  const command = inp["command"] ?? inp["cmd"] ?? inp["input"]
  if (typeof command !== "string") return false
  // Starts with "gh " or has /gh as a path segment
  return command.trimStart().startsWith("gh ") || /[/\\]gh /.test(command)
}
