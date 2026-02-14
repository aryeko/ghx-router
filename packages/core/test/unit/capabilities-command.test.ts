import { beforeEach, describe, expect, it, vi } from "vitest"

const listCapabilitiesMock = vi.fn()
const explainCapabilityMock = vi.fn()

vi.mock("../../src/agent-interface/tools/list-capabilities-tool.js", () => ({
  listCapabilities: (...args: unknown[]) => listCapabilitiesMock(...args)
}))

vi.mock("../../src/agent-interface/tools/explain-tool.js", () => ({
  explainCapability: (...args: unknown[]) => explainCapabilityMock(...args)
}))

import { capabilitiesCommand } from "../../src/cli/commands/capabilities.js"

describe("capabilities command", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("prints capability list", async () => {
    listCapabilitiesMock.mockReturnValue([
      { capability_id: "repo.view", description: "Repository view" }
    ])
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesCommand(["list"])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith("[\n  {\n    \"capability_id\": \"repo.view\",\n    \"description\": \"Repository view\"\n  }\n]\n")
  })

  it("prints capability explanation", async () => {
    explainCapabilityMock.mockReturnValue({
      capability_id: "repo.view",
      purpose: "Repository view",
      required_inputs: ["owner", "name"],
      preferred_route: "cli",
      fallback_routes: ["graphql"],
      output_fields: ["id", "name"]
    })
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesCommand(["explain", "repo.view"])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalledWith("{\n  \"capability_id\": \"repo.view\",\n  \"purpose\": \"Repository view\",\n  \"required_inputs\": [\n    \"owner\",\n    \"name\"\n  ],\n  \"preferred_route\": \"cli\",\n  \"fallback_routes\": [\n    \"graphql\"\n  ],\n  \"output_fields\": [\n    \"id\",\n    \"name\"\n  ]\n}\n")
  })

  it("returns usage error for invalid subcommand", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await capabilitiesCommand(["nope"])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith("Usage:\n  ghx capabilities list\n  ghx capabilities explain <capability_id>\n")
  })
})
