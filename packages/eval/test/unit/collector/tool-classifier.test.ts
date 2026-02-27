import { classifyToolCall } from "@eval/collector/tool-classifier.js"
import { describe, expect, it } from "vitest"

describe("classifyToolCall", () => {
  it("classifies ghx tool calls", () => {
    expect(classifyToolCall("ghx")).toBe("ghx")
    expect(classifyToolCall("ghx.pr.view")).toBe("ghx")
    expect(classifyToolCall("ghx_run")).toBe("ghx")
  })

  it("classifies MCP tool calls", () => {
    expect(classifyToolCall("github_pr_view")).toBe("mcp")
    expect(classifyToolCall("mcp_github_list_issues")).toBe("mcp")
    expect(classifyToolCall("mcp__github__get_pr")).toBe("mcp")
  })

  it("classifies file operation tools", () => {
    expect(classifyToolCall("read_file")).toBe("file_ops")
    expect(classifyToolCall("write_file")).toBe("file_ops")
    expect(classifyToolCall("edit_file")).toBe("file_ops")
    expect(classifyToolCall("list_files")).toBe("file_ops")
    expect(classifyToolCall("Read")).toBe("file_ops")
    expect(classifyToolCall("Write")).toBe("file_ops")
    expect(classifyToolCall("Edit")).toBe("file_ops")
  })

  it("classifies bash tool with gh CLI command as gh_cli", () => {
    expect(classifyToolCall("bash", { command: "gh pr view 42 --json title" })).toBe("gh_cli")
    expect(classifyToolCall("Bash", { command: "gh issue list" })).toBe("gh_cli")
    expect(classifyToolCall("shell", { command: "  gh api repos/owner/repo" })).toBe("gh_cli")
  })

  it("classifies bash tool without gh CLI command as bash", () => {
    expect(classifyToolCall("bash", { command: "git log --oneline" })).toBe("bash")
    expect(classifyToolCall("bash", { command: "ls -la" })).toBe("bash")
    expect(classifyToolCall("terminal")).toBe("bash")
  })

  it("classifies unknown tools as other", () => {
    expect(classifyToolCall("custom_tool")).toBe("other")
    expect(classifyToolCall("some_random_tool")).toBe("other")
  })

  it("handles missing input gracefully", () => {
    expect(classifyToolCall("bash")).toBe("bash")
    expect(classifyToolCall("bash", null)).toBe("bash")
    expect(classifyToolCall("bash", undefined)).toBe("bash")
  })
})
