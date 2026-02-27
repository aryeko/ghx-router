import { loadEvalConfig } from "@eval/config/loader.js"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("loadEvalConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("loads config from a valid YAML string", () => {
    const yaml = `
modes:
  - ghx
  - baseline
models:
  - id: openai/gpt-5.3-codex
    label: Codex 5.3
provider:
  port: 4000
`
    const config = loadEvalConfig(yaml)
    expect(config.modes).toEqual(["ghx", "baseline"])
    expect(config.provider.port).toBe(4000)
    expect(config.models[0]?.id).toBe("openai/gpt-5.3-codex")
  })

  it("applies PROFILER_REPETITIONS env override", () => {
    vi.stubEnv("PROFILER_REPETITIONS", "10")
    const yaml = `
modes: [ghx]
models:
  - id: m
    label: m
`
    const config = loadEvalConfig(yaml)
    expect(config.execution.repetitions).toBe(10)
  })

  it("applies EVAL_PROVIDER_PORT env override", () => {
    vi.stubEnv("EVAL_PROVIDER_PORT", "5000")
    const yaml = `
modes: [ghx]
models:
  - id: m
    label: m
`
    const config = loadEvalConfig(yaml)
    expect(config.provider.port).toBe(5000)
  })

  it("applies PROFILER_MODES env override", () => {
    vi.stubEnv("PROFILER_MODES", "ghx,mcp,baseline")
    const yaml = `
modes: [ghx]
models:
  - id: m
    label: m
`
    const config = loadEvalConfig(yaml)
    expect(config.modes).toEqual(["ghx", "mcp", "baseline"])
  })

  it("applies PROFILER_WARMUP false override", () => {
    vi.stubEnv("PROFILER_WARMUP", "false")
    const yaml = `
modes: [ghx]
models:
  - id: m
    label: m
`
    const config = loadEvalConfig(yaml)
    expect(config.execution.warmup).toBe(false)
  })

  it("applies EVAL_MODEL override", () => {
    vi.stubEnv("EVAL_MODEL", "anthropic/claude-sonnet-4-6")
    const yaml = `
modes: [ghx]
models:
  - id: openai/gpt-5.3-codex
    label: Codex
`
    const config = loadEvalConfig(yaml)
    expect(config.models).toHaveLength(1)
    expect(config.models[0]?.id).toBe("anthropic/claude-sonnet-4-6")
  })

  it("applies PROFILER_LOG_LEVEL env override", () => {
    vi.stubEnv("PROFILER_LOG_LEVEL", "debug")
    const yaml = `
modes: [ghx]
models:
  - id: m
    label: m
`
    const config = loadEvalConfig(yaml)
    expect(config.output.log_level).toBe("debug")
  })

  it("applies EVAL_PROVIDER_ID env override", () => {
    vi.stubEnv("EVAL_PROVIDER_ID", "anthropic")
    const yaml = `
modes: [ghx]
models:
  - id: m
    label: m
`
    const config = loadEvalConfig(yaml)
    expect(config.provider.id).toBe("anthropic")
  })

  it("throws on invalid YAML config", () => {
    const yaml = `
modes: []
models:
  - id: m
    label: m
`
    expect(() => loadEvalConfig(yaml)).toThrow()
  })
})
