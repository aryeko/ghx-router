import { ProfilerConfigSchema } from "@profiler/config/schema.js"
import { describe, expect, it } from "vitest"

describe("ProfilerConfigSchema", () => {
  const minimalInput = {
    modes: ["agent_direct"],
    scenarios: { set: "core" },
  }

  it("accepts minimal valid config and fills defaults", () => {
    const result = ProfilerConfigSchema.parse(minimalInput)

    expect(result.modes).toEqual(["agent_direct"])
    expect(result.scenarios).toEqual({ set: "core" })
    expect(result.execution).toEqual({
      repetitions: 5,
      warmup: true,
      timeoutDefaultMs: 120_000,
      allowedRetries: 0,
    })
    expect(result.output).toEqual({
      resultsDir: "results",
      reportsDir: "reports",
      sessionExport: true,
      logLevel: "info",
    })
    expect(result.extensions).toEqual({})
  })

  it("parses a full config correctly", () => {
    const full = {
      modes: ["agent_direct", "mcp"],
      scenarios: { set: "core", ids: ["sc-001", "sc-002"] },
      execution: { repetitions: 10, warmup: false, timeoutDefaultMs: 60_000 },
      output: {
        resultsDir: "out/results",
        reportsDir: "out/reports",
        sessionExport: false,
        logLevel: "debug",
      },
      extensions: { custom: "value" },
    }

    const result = ProfilerConfigSchema.parse(full)

    expect(result.modes).toEqual(["agent_direct", "mcp"])
    expect(result.scenarios.ids).toEqual(["sc-001", "sc-002"])
    expect(result.execution.repetitions).toBe(10)
    expect(result.execution.warmup).toBe(false)
    expect(result.execution.timeoutDefaultMs).toBe(60_000)
    expect(result.output.logLevel).toBe("debug")
    expect(result.output.sessionExport).toBe(false)
    expect(result.extensions).toEqual({ custom: "value" })
  })

  it("rejects config with missing modes array", () => {
    expect(() => ProfilerConfigSchema.parse({ scenarios: { set: "core" } })).toThrow()
  })

  it("rejects config with empty modes array", () => {
    expect(() => ProfilerConfigSchema.parse({ modes: [], scenarios: { set: "core" } })).toThrow()
  })

  it("uses correct defaults for execution fields", () => {
    const result = ProfilerConfigSchema.parse(minimalInput)

    expect(result.execution.repetitions).toBe(5)
    expect(result.execution.warmup).toBe(true)
    expect(result.execution.timeoutDefaultMs).toBe(120_000)
    expect(result.execution.allowedRetries).toBe(0)
  })

  it("defaults allowedRetries to 0", () => {
    const result = ProfilerConfigSchema.parse(minimalInput)
    expect(result.execution.allowedRetries).toBe(0)
  })

  it("accepts positive integer allowedRetries", () => {
    const result = ProfilerConfigSchema.parse({
      ...minimalInput,
      execution: { allowedRetries: 3 },
    })
    expect(result.execution.allowedRetries).toBe(3)
  })

  it("rejects negative allowedRetries", () => {
    expect(() =>
      ProfilerConfigSchema.parse({
        ...minimalInput,
        execution: { allowedRetries: -1 },
      }),
    ).toThrow()
  })

  it("uses correct defaults for output fields", () => {
    const result = ProfilerConfigSchema.parse(minimalInput)

    expect(result.output.logLevel).toBe("info")
    expect(result.output.resultsDir).toBe("results")
    expect(result.output.reportsDir).toBe("reports")
    expect(result.output.sessionExport).toBe(true)
  })
})
