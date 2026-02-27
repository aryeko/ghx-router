import { EvalConfigSchema } from "@eval/config/schema.js"
import { describe, expect, it } from "vitest"

describe("EvalConfigSchema", () => {
  it("parses a valid full config", () => {
    const raw = {
      modes: ["ghx", "baseline", "mcp"],
      scenarios: { set: "default" },
      execution: { repetitions: 5, warmup: true, timeout_default_ms: 120000 },
      output: {
        results_dir: "results",
        reports_dir: "reports",
        session_export: true,
        log_level: "info",
      },
      provider: { id: "opencode", port: 3001 },
      models: [{ id: "openai/gpt-5.3-codex", label: "Codex 5.3" }],
      fixtures: {
        repo: "aryeko/ghx-bench-fixtures",
        manifest: "fixtures/latest.json",
        seed_if_missing: false,
        reseed_between_modes: false,
      },
    }
    const result = EvalConfigSchema.parse(raw)
    expect(result.modes).toEqual(["ghx", "baseline", "mcp"])
    expect(result.provider.port).toBe(3001)
    expect(result.models).toHaveLength(1)
    expect(result.models[0]?.label).toBe("Codex 5.3")
  })

  it("applies defaults for optional fields", () => {
    const minimal = {
      modes: ["ghx"],
      models: [{ id: "openai/gpt-5.3-codex", label: "Codex" }],
    }
    const result = EvalConfigSchema.parse(minimal)
    expect(result.execution.repetitions).toBe(5)
    expect(result.execution.warmup).toBe(true)
    expect(result.provider.port).toBe(3001)
    expect(result.output.session_export).toBe(true)
    expect(result.output.log_level).toBe("info")
    expect(result.fixtures.manifest).toBe("fixtures/latest.json")
  })

  it("rejects empty modes array", () => {
    expect(() => EvalConfigSchema.parse({ modes: [], models: [{ id: "x", label: "x" }] })).toThrow()
  })

  it("accepts valid mode values", () => {
    const result = EvalConfigSchema.parse({ modes: ["ghx"], models: [{ id: "x", label: "x" }] })
    expect(result.modes).toEqual(["ghx"])
  })

  it("rejects unknown mode values", () => {
    expect(() =>
      EvalConfigSchema.parse({ modes: ["unknown-mode"], models: [{ id: "x", label: "x" }] }),
    ).toThrow()
  })

  it("rejects config with no models", () => {
    expect(() => EvalConfigSchema.parse({ modes: ["ghx"], models: [] })).toThrow()
  })

  it("rejects invalid log_level", () => {
    expect(() =>
      EvalConfigSchema.parse({
        modes: ["ghx"],
        models: [{ id: "x", label: "x" }],
        output: { log_level: "verbose" },
      }),
    ).toThrow()
  })
})
