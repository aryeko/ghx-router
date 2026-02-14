import { afterEach, describe, expect, it, vi } from "vitest"

import { capabilitiesExplainCommand } from "../../src/cli/commands/capabilities-explain.js"
import { capabilitiesListCommand } from "../../src/cli/commands/capabilities-list.js"

describe("capabilities CLI commands", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("lists capabilities in text output by default", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesListCommand([])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalled()
    expect(stdout.mock.calls.join("\n")).toContain("repo.view")
  })

  it("lists capabilities in JSON with --json", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesListCommand(["--json"])

    expect(code).toBe(0)
    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(joined).toContain("capability_id")
    expect(joined).toContain("repo.view")
  })

  it("prints usage and exits 1 when explain has no capability id", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await capabilitiesExplainCommand([])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith("Usage: ghx capabilities explain <capability_id> [--json]\n")
  })

  it("explains a capability in text output by default", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesExplainCommand(["repo.view"])

    expect(code).toBe(0)
    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(joined).toContain("repo.view")
    expect(joined).toContain("preferred_route")
  })

  it("explains a capability in JSON with --json", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesExplainCommand(["repo.view", "--json"])

    expect(code).toBe(0)
    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(joined).toContain("capability_id")
    expect(joined).toContain("repo.view")
  })

  it("prints error and exits 1 for unknown capability", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await capabilitiesExplainCommand(["unknown.capability"])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith("Unknown capability: unknown.capability\n")
  })
})
