import { parseArgs } from "@bench/cli/run-scenario.js"
import { describe, expect, it } from "vitest"

describe("run-scenario parseArgs", () => {
  it("parses required --scenario flag", () => {
    const args = parseArgs(["--scenario", "pr-fix-review-comments-wf-001", "--mode", "ghx"])

    expect(args.scenario).toBe("pr-fix-review-comments-wf-001")
    expect(args.mode).toBe("ghx")
  })

  it("throws on missing --scenario", () => {
    expect(() => parseArgs(["--mode", "ghx"])).toThrow("Missing required flag: --scenario")
  })

  it("defaults mode to ghx", () => {
    const args = parseArgs(["--scenario", "test-001"])

    expect(args.mode).toBe("ghx")
  })

  it("defaults retries to 1", () => {
    const args = parseArgs(["--scenario", "test-001"])

    expect(args.retries).toBe(1)
  })

  it("parses --retries flag", () => {
    const args = parseArgs(["--scenario", "test-001", "--retries", "3"])

    expect(args.retries).toBe(3)
  })

  it("parses --skip-cleanup and --verbose flags", () => {
    const args = parseArgs(["--scenario", "test-001", "--skip-cleanup", "--verbose"])

    expect(args.skipCleanup).toBe(true)
    expect(args.verbose).toBe(true)
  })

  it("defaults skipCleanup and verbose to false", () => {
    const args = parseArgs(["--scenario", "test-001"])

    expect(args.skipCleanup).toBe(false)
    expect(args.verbose).toBe(false)
  })

  it("parses --repo flag", () => {
    const args = parseArgs(["--scenario", "test-001", "--repo", "owner/repo"])

    expect(args.repo).toBe("owner/repo")
  })

  it("parses agent_direct mode", () => {
    const args = parseArgs(["--scenario", "test-001", "--mode", "agent_direct"])

    expect(args.mode).toBe("agent_direct")
  })

  it("rejects invalid mode", () => {
    expect(() => parseArgs(["--scenario", "test-001", "--mode", "invalid"])).toThrow()
  })

  it("strips -- separator from args", () => {
    const args = parseArgs(["--", "--scenario", "test-001", "--mode", "ghx"])

    expect(args.scenario).toBe("test-001")
    expect(args.mode).toBe("ghx")
  })

  it("defaults iterations to 1", () => {
    const args = parseArgs(["--scenario", "test-001"])

    expect(args.iterations).toBe(1)
  })

  it("parses --iterations flag", () => {
    const args = parseArgs(["--scenario", "test-001", "--iterations", "3"])

    expect(args.iterations).toBe(3)
  })

  it("rejects iterations below 1", () => {
    expect(() => parseArgs(["--scenario", "test-001", "--iterations", "0"])).toThrow()
  })

  it("rejects iterations above 20", () => {
    expect(() => parseArgs(["--scenario", "test-001", "--iterations", "21"])).toThrow()
  })
})
