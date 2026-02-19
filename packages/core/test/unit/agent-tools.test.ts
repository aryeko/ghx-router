import { describe, expect, it, vi } from "vitest"

import { createExecuteTool } from "../../src/core/execute/execute-tool.js"
import { explainCapability } from "../../src/core/registry/explain-capability.js"
import { listCapabilities } from "../../src/core/registry/list-capabilities.js"

describe("agent interface tools", () => {
  it("execute tool delegates to executeTask", async () => {
    const executeTask = vi.fn(async () => ({
      ok: true,
      data: { id: "repo-id" },
      meta: { capability_id: "repo.view", route_used: "graphql" as const },
    }))

    const tool = createExecuteTool({ executeTask })
    const result = await tool.execute("repo.view", { owner: "acme", name: "modkit" })

    expect(result.ok).toBe(true)
    expect(executeTask).toHaveBeenCalledWith({
      task: "repo.view",
      input: { owner: "acme", name: "modkit" },
    })
  })

  it("explain tool returns compact capability summary", () => {
    const explained = explainCapability("issue.view")
    expect(explained).toEqual(
      expect.objectContaining({
        capability_id: "issue.view",
        preferred_route: "cli",
      }),
    )
    expect(explained.required_inputs).toContain("issueNumber")
  })

  it("throws for unknown capability in explain tool", () => {
    expect(() => explainCapability("unknown.capability")).toThrow("Unknown capability")
  })

  it("explain tool includes pagination input for issue comments", () => {
    const explained = explainCapability("issue.comments.list")
    expect(explained.required_inputs).toContain("first")
  })

  it("list_capabilities returns ids and descriptions", () => {
    const items = listCapabilities()
    expect(items.length).toBeGreaterThan(0)
    expect(items[0]).toEqual(
      expect.objectContaining({
        capability_id: expect.any(String),
        description: expect.any(String),
      }),
    )
  })
})
