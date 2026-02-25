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

  it("shows optional inputs with ? suffix in text output", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await capabilitiesListCommand(["--domain", "pr"])

    const output = stdout.mock.calls.map((call) => String(call[0])).join("")
    // pr.reviews.submit has optional body and comments fields
    expect(output).toMatch(/pr\.reviews\.submit\s+-.+body\?/)
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

  it("includes optional_inputs array in JSON output", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await capabilitiesListCommand(["--domain", "pr", "--json"])

    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    const parsed = JSON.parse(joined)
    const reviewSubmit = parsed.find(
      (item: { capability_id: string }) => item.capability_id === "pr.reviews.submit",
    )
    expect(reviewSubmit).toBeDefined()
    expect(reviewSubmit.optional_inputs).toEqual(expect.arrayContaining(["body", "comments"]))
  })

  it("explains a capability with optional_inputs in JSON output", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await capabilitiesExplainCommand(["pr.reviews.submit", "--json"])

    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    const parsed = JSON.parse(joined)
    expect(parsed.optional_inputs).toBeDefined()
    expect(parsed.optional_inputs).toHaveProperty("body")
    expect(parsed.optional_inputs).toHaveProperty("comments")
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

  it("includes optional_inputs_detail in JSON output", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await capabilitiesListCommand(["--domain", "pr", "--json"])

    const joined = stdout.mock.calls.map((call) => String(call[0])).join("")
    const parsed = JSON.parse(joined)
    const reviewSubmit = parsed.find(
      (item: { capability_id: string }) => item.capability_id === "pr.reviews.submit",
    )
    expect(reviewSubmit).toBeDefined()
    expect(reviewSubmit.optional_inputs_detail).toBeDefined()
    expect(reviewSubmit.optional_inputs_detail).toHaveProperty("comments")
    const comments = reviewSubmit.optional_inputs_detail.comments as {
      type: string
      items: { properties: Record<string, unknown> }
    }
    expect(comments.type).toBe("array")
    expect(comments.items.properties).toHaveProperty("startLine")
    expect(comments.items.properties).toHaveProperty("startSide")
  })

  it("shows array item hints in text output for pr.reviews.submit", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

    await capabilitiesListCommand(["--domain", "pr"])

    const output = stdout.mock.calls.map((call) => String(call[0])).join("")
    expect(output).toMatch(
      /pr\.reviews\.submit\s+-.+comments\?\[path, body, line, side\?, startLine\?, startSide\?\]/,
    )
  })

  describe("--compact flag", () => {
    it("outputs id(inputs) without description", async () => {
      const writes: string[] = []
      vi.spyOn(process.stdout, "write").mockImplementation((s) => {
        writes.push(String(s))
        return true
      })
      await capabilitiesListCommand(["--compact", "--domain", "issue"])
      const out = writes.join("")
      expect(out).toContain("issue.view(owner,name,issueNumber)")
      expect(out).not.toContain("Fetch one issue")
    })

    it("appends [replaces all] to .set capabilities that have an .add sibling", async () => {
      const writes: string[] = []
      vi.spyOn(process.stdout, "write").mockImplementation((s) => {
        writes.push(String(s))
        return true
      })
      await capabilitiesListCommand(["--compact", "--domain", "issue"])
      const out = writes.join("")
      expect(out).toContain("issue.labels.set(owner,name,issueNumber,labels) [replaces all]")
      expect(out).toContain("issue.labels.add(owner,name,issueNumber,labels)")
      expect(out).not.toContain("issue.labels.add(owner,name,issueNumber,labels) [replaces all]")
    })

    it("does not append [replaces all] to .set capabilities without an .add sibling", async () => {
      const writes: string[] = []
      vi.spyOn(process.stdout, "write").mockImplementation((s) => {
        writes.push(String(s))
        return true
      })
      await capabilitiesListCommand(["--compact", "--domain", "issue"])
      const out = writes.join("")
      expect(out).toContain("issue.milestone.set(")
      expect(out).not.toContain(
        "issue.milestone.set(owner,name,issueNumber,milestoneNumber) [replaces all]",
      )
    })

    it("works with --domain filter", async () => {
      const writes: string[] = []
      vi.spyOn(process.stdout, "write").mockImplementation((s) => {
        writes.push(String(s))
        return true
      })
      await capabilitiesListCommand(["--compact", "--domain", "repo"])
      const out = writes.join("")
      expect(out).not.toContain("issue.")
      expect(out).toContain("repo.")
    })

    it("works without --domain (all capabilities)", async () => {
      const writes: string[] = []
      vi.spyOn(process.stdout, "write").mockImplementation((s) => {
        writes.push(String(s))
        return true
      })
      await capabilitiesListCommand(["--compact"])
      const out = writes.join("")
      expect(out).toContain("issue.")
      expect(out).toContain("pr.")
    })
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
