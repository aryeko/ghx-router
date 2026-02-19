import { parseCliArgs } from "@bench/cli/args.js"
import { describe, expect, it } from "vitest"

describe("parseCliArgs", () => {
  it("parses mode, reps, and scenario", () => {
    const parsed = parseCliArgs(["run", "agent_direct", "3", "--scenario", "pr-view-001"])

    expect(parsed.command).toBe("run")
    expect(parsed.mode).toBe("agent_direct")
    expect(parsed.repetitions).toBe(3)
    expect(parsed.scenarioFilter).toEqual(["pr-view-001"])
    expect(parsed.scenarioSet).toBeNull()
  })

  it("parses repeated scenario flags", () => {
    const parsed = parseCliArgs([
      "run",
      "ghx",
      "1",
      "--scenario",
      "a",
      "--scenario",
      "b",
      "--scenario=c",
    ])

    expect(parsed.scenarioFilter).toEqual(["a", "b", "c"])
  })

  it("rejects scenario flags without values", () => {
    expect(() => parseCliArgs(["run", "ghx", "1", "--scenario"])).toThrow(
      "Missing value for --scenario",
    )
    expect(() => parseCliArgs(["run", "ghx", "1", "--scenario", "--model", "x"])).toThrow(
      "Missing value for --scenario",
    )
    expect(() => parseCliArgs(["run", "ghx", "1", "--scenario="])).toThrow(
      "Missing value for --scenario",
    )
  })

  it("parses scenario-set flag", () => {
    const parsed = parseCliArgs(["run", "ghx", "1", "--scenario-set", "pr-review-reads"])

    expect(parsed.scenarioSet).toBe("pr-review-reads")
    expect(parsed.scenarioFilter).toBeNull()
  })

  it("parses fixture manifest options", () => {
    const parsed = parseCliArgs([
      "run",
      "ghx",
      "2",
      "--scenario-set",
      "full-seeded",
      "--fixture-manifest",
      "fixtures/latest.json",
      "--seed-if-missing",
    ])

    expect(parsed.fixtureManifestPath).toBe("fixtures/latest.json")
    expect(parsed.seedIfMissing).toBe(true)
  })

  it("parses provider, model, and output path options", () => {
    const parsed = parseCliArgs([
      "run",
      "ghx",
      "2",
      "--provider",
      "openai",
      "--model",
      "gpt-5.1-codex-mini",
      "--output-jsonl",
      "reports/custom-suite.jsonl",
    ])

    expect(parsed.providerId).toBe("openai")
    expect(parsed.modelId).toBe("gpt-5.1-codex-mini")
    expect(parsed.outputJsonlPath).toBe("reports/custom-suite.jsonl")
  })

  it("rejects provider/model/output flags without values", () => {
    expect(() => parseCliArgs(["run", "ghx", "1", "--provider"])).toThrow(
      "Missing value for --provider",
    )
    expect(() =>
      parseCliArgs(["run", "ghx", "1", "--provider", "--model", "gpt-5.1-codex-mini"]),
    ).toThrow("Missing value for --provider")
    expect(() => parseCliArgs(["run", "ghx", "1", "--model"])).toThrow("Missing value for --model")
    expect(() => parseCliArgs(["run", "ghx", "1", "--output-jsonl"])).toThrow(
      "Missing value for --output-jsonl",
    )
    expect(() => parseCliArgs(["run", "ghx", "1", "--provider="])).toThrow(
      "Missing value for --provider",
    )
    expect(() => parseCliArgs(["run", "ghx", "1", "--model="])).toThrow("Missing value for --model")
    expect(() => parseCliArgs(["run", "ghx", "1", "--output-jsonl="])).toThrow(
      "Missing value for --output-jsonl",
    )
  })

  it("parses inline fixture manifest option", () => {
    const parsed = parseCliArgs(["run", "--fixture-manifest=fixtures/inline.json"])
    expect(parsed.fixtureManifestPath).toBe("fixtures/inline.json")
  })

  it("defaults repetitions to 1 when omitted", () => {
    const parsed = parseCliArgs(["run", "agent_direct"])

    expect(parsed.repetitions).toBe(1)
  })

  it("supports pnpm forwarded args with separator", () => {
    const parsed = parseCliArgs(["run", "--", "--scenario", "pr-view-001"])

    expect(parsed.mode).toBe("ghx")
    expect(parsed.repetitions).toBe(1)
    expect(parsed.scenarioFilter).toEqual(["pr-view-001"])
  })

  it("supports inline scenario flag without positional args", () => {
    const parsed = parseCliArgs(["run", "--scenario=issue-view-001"])

    expect(parsed.mode).toBe("ghx")
    expect(parsed.repetitions).toBe(1)
    expect(parsed.scenarioFilter).toEqual(["issue-view-001"])
  })

  it("supports inline scenario-set flag", () => {
    const parsed = parseCliArgs(["run", "--scenario-set=ci-diagnostics"])

    expect(parsed.mode).toBe("ghx")
    expect(parsed.repetitions).toBe(1)
    expect(parsed.scenarioSet).toBe("ci-diagnostics")
  })

  it("treats --scenario-set with missing value as unset", () => {
    const parsed = parseCliArgs(["run", "--scenario-set"])
    expect(parsed.scenarioSet).toBeNull()
  })

  it("rejects unsupported commands and modes", () => {
    expect(() => parseCliArgs(["validate"])).toThrow("Unsupported command")
    expect(() => parseCliArgs(["run", "invalid_mode"])).toThrow("Unsupported mode")
  })

  it("rejects invalid repetitions", () => {
    expect(() => parseCliArgs(["run", "ghx", "0"])).toThrow("Invalid repetitions")
    expect(() => parseCliArgs(["run", "ghx", "1.5"])).toThrow("Invalid repetitions")
  })

  it("rejects using scenario and scenario-set together", () => {
    expect(() =>
      parseCliArgs(["run", "ghx", "1", "--scenario", "a", "--scenario-set", "b"]),
    ).toThrow("--scenario and --scenario-set cannot be used together")
  })

  it("ignores sparse argv holes when splitting positionals and flags", () => {
    const parsed = parseCliArgs(["run", undefined as unknown as string, "ghx", "2"])
    expect(parsed.mode).toBe("ghx")
    expect(parsed.repetitions).toBe(2)
  })
})
