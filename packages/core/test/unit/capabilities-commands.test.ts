import { capabilitiesExplainCommand } from "@core/cli/commands/capabilities-explain.js"
import { capabilitiesListCommand } from "@core/cli/commands/capabilities-list.js"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("capabilities CLI commands", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("lists capabilities in text output by default", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesListCommand([])

    expect(code).toBe(0)
    expect(stdout).toHaveBeenCalled()
    const output = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(output).toContain("repo.view")
  })

  it("shows required_inputs in brackets in text output", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await capabilitiesListCommand([])

    const output = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(output).toMatch(/repo\.view\s+-.+\[owner, name\]/)
  })

  it("lists capabilities in JSON with --json", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesListCommand(["--json"])

    expect(code).toBe(0)
    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(joined).toContain("capability_id")
    expect(joined).toContain("repo.view")
    expect(joined).toContain("required_inputs")
  })

  it("includes required_inputs arrays in JSON output", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await capabilitiesListCommand(["--json"])

    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    const parsed = JSON.parse(joined)
    const repoView = parsed.find(
      (item: { capability_id: string }) => item.capability_id === "repo.view",
    )
    expect(repoView).toBeDefined()
    expect(repoView.required_inputs).toEqual(expect.arrayContaining(["owner", "name"]))
  })

  it("filters by domain with --domain flag", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    const code = await capabilitiesListCommand(["--domain", "pr"])

    expect(code).toBe(0)
    const output = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(output).toContain("pr.view")
    expect(output).not.toContain("repo.view")
    expect(output).not.toContain("issue.view")
  })

  it("filters by domain in JSON output", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await capabilitiesListCommand(["--domain", "repo", "--json"])

    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    const parsed = JSON.parse(joined) as Array<{ capability_id: string }>
    expect(parsed.length).toBeGreaterThan(0)
    for (const item of parsed) {
      expect(item.capability_id).toMatch(/^repo\./)
    }
  })

  it("returns error for unknown domain", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await capabilitiesListCommand(["--domain", "nonexistent"])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith("No capabilities found for domain: nonexistent\n")
  })

  it("prints usage and exits 1 when explain has no capability id", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

    const code = await capabilitiesExplainCommand([])

    expect(code).toBe(1)
    expect(stderr).toHaveBeenCalledWith(
      "Usage: ghx capabilities explain <capability_id> [--json]\n",
    )
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
