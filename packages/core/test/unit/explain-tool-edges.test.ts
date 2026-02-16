import { describe, expect, it, vi } from "vitest"

const { getOperationCardMock } = vi.hoisted(() => ({
  getOperationCardMock: vi.fn(),
}))

vi.mock("../../src/core/registry/index.js", () => ({
  getOperationCard: getOperationCardMock,
}))

import { explainCapability } from "../../src/agent-interface/tools/explain-tool.js"

describe("explain tool edge cases", () => {
  it("returns empty input/output lists when schemas are malformed", () => {
    getOperationCardMock.mockReturnValueOnce({
      capability_id: "repo.view",
      description: "View repository",
      input_schema: { required: "owner" },
      output_schema: { properties: null },
      routing: { preferred: "graphql", fallbacks: ["cli"] },
    })

    const explained = explainCapability("repo.view")
    expect(explained.required_inputs).toEqual([])
    expect(explained.output_fields).toEqual([])
  })

  it("filters non-string required inputs", () => {
    getOperationCardMock.mockReturnValueOnce({
      capability_id: "repo.view",
      description: "View repository",
      input_schema: { required: ["owner", 1, null, "name"] },
      output_schema: { properties: { id: { type: "string" } } },
      routing: { preferred: "graphql", fallbacks: ["cli"] },
    })

    const explained = explainCapability("repo.view")
    expect(explained.required_inputs).toEqual(["owner", "name"])
    expect(explained.output_fields).toEqual(["id"])
  })

  it("handles null schemas", () => {
    getOperationCardMock.mockReturnValueOnce({
      capability_id: "repo.view",
      description: "View repository",
      input_schema: null,
      output_schema: null,
      routing: { preferred: "graphql", fallbacks: ["cli"] },
    })

    const explained = explainCapability("repo.view")
    expect(explained.required_inputs).toEqual([])
    expect(explained.output_fields).toEqual([])
  })
})
