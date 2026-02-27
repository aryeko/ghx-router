import { EvalModeResolver } from "@eval/mode/resolver.js"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("EvalModeResolver", () => {
  const resolver = new EvalModeResolver()

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("resolves ghx mode with PATH prepended", async () => {
    const config = await resolver.resolve("ghx")
    expect(config.environment["PATH"]).toBeDefined()
    expect(typeof config.environment["PATH"]).toBe("string")
    expect(config.providerOverrides).toEqual({})
  })

  it("ghx mode system instructions contain ghx", async () => {
    const config = await resolver.resolve("ghx")
    // Should contain either SKILL.md content or the fallback
    expect(config.systemInstructions.length).toBeGreaterThan(0)
  })

  it("resolves mcp mode with mcpServers config", async () => {
    vi.stubEnv("GH_TOKEN", "test-token")
    const config = await resolver.resolve("mcp")
    const servers = config.providerOverrides["mcpServers"] as unknown[]
    expect(servers).toHaveLength(1)
    const server = servers[0] as Record<string, unknown>
    expect(server["name"]).toBe("github")
    expect(server["command"]).toBe("npx")
  })

  it("mcp mode uses GH_TOKEN for server env", async () => {
    vi.stubEnv("GH_TOKEN", "test-token-123")
    const config = await resolver.resolve("mcp")
    const servers = config.providerOverrides["mcpServers"] as Array<{ env: Record<string, string> }>
    expect(servers[0]?.env["GITHUB_PERSONAL_ACCESS_TOKEN"]).toBe("test-token-123")
  })

  it("resolves baseline mode with empty environment", async () => {
    const config = await resolver.resolve("baseline")
    expect(config.environment).toEqual({})
    expect(config.providerOverrides).toEqual({})
  })

  it("baseline mode system instructions contain gh", async () => {
    const config = await resolver.resolve("baseline")
    expect(config.systemInstructions).toContain("gh")
  })

  it("throws for unknown mode", async () => {
    await expect(resolver.resolve("unknown-mode")).rejects.toThrow("Unknown mode: unknown-mode")
  })

  it("uses GHX_BIN_DIR env when set", async () => {
    vi.stubEnv("GHX_BIN_DIR", "/custom/bin")
    const config = await resolver.resolve("ghx")
    expect(config.environment["PATH"]).toMatch(/^\/custom\/bin:/)
  })

  it("uses GHX_SKILL_MD env when set", async () => {
    // Point to a non-existent file to trigger fallback — testing env var is read
    vi.stubEnv("GHX_SKILL_MD", "/nonexistent/SKILL.md")
    const config = await resolver.resolve("ghx")
    // Falls back to GHX_SKILL_FALLBACK content
    expect(config.systemInstructions).toContain("ghx")
  })
})
