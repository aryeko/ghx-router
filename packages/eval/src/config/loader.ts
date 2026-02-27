import { parse as parseYaml } from "yaml"
import type { EvalConfig } from "./schema.js"
import { EvalConfigSchema } from "./schema.js"

function applyEnvOverrides(raw: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...raw }

  const repetitions = process.env["PROFILER_REPETITIONS"]
  if (repetitions !== undefined) {
    result["execution"] = {
      ...((result["execution"] as Record<string, unknown>) ?? {}),
      repetitions: Number(repetitions),
    }
  }

  const warmup = process.env["PROFILER_WARMUP"]
  if (warmup !== undefined) {
    result["execution"] = {
      ...((result["execution"] as Record<string, unknown>) ?? {}),
      warmup: warmup === "true",
    }
  }

  const logLevel = process.env["PROFILER_LOG_LEVEL"]
  if (logLevel !== undefined) {
    result["output"] = {
      ...((result["output"] as Record<string, unknown>) ?? {}),
      log_level: logLevel,
    }
  }

  const modes = process.env["PROFILER_MODES"]
  if (modes !== undefined) {
    result["modes"] = modes.split(",").map((s) => s.trim())
  }

  const providerPort = process.env["EVAL_PROVIDER_PORT"]
  if (providerPort !== undefined) {
    result["provider"] = {
      ...((result["provider"] as Record<string, unknown>) ?? {}),
      port: Number(providerPort),
    }
  }

  const providerId = process.env["EVAL_PROVIDER_ID"]
  if (providerId !== undefined) {
    result["provider"] = {
      ...((result["provider"] as Record<string, unknown>) ?? {}),
      id: providerId,
    }
  }

  const model = process.env["EVAL_MODEL"]
  if (model !== undefined) {
    result["models"] = [{ id: model, label: model }]
  }

  return result
}

/**
 * Parses and validates an eval configuration from a YAML string.
 *
 * Environment variables override config file values:
 * `PROFILER_REPETITIONS`, `PROFILER_WARMUP`, `PROFILER_LOG_LEVEL`,
 * `PROFILER_MODES`, `EVAL_PROVIDER_PORT`, `EVAL_PROVIDER_ID`, `EVAL_MODEL`.
 *
 * @param yamlContent - Raw YAML string from e.g. `fs.readFile`
 * @returns Validated {@link EvalConfig} with defaults applied
 * @throws {ZodError} When required fields are missing or values are invalid
 *
 * @example
 * ```typescript
 * import { readFile } from "node:fs/promises"
 * import { loadEvalConfig } from "@ghx-dev/eval"
 *
 * const config = loadEvalConfig(
 *   await readFile("config/eval.config.yaml", "utf-8")
 * )
 * ```
 */
export function loadEvalConfig(yamlContent: string): EvalConfig {
  const raw = parseYaml(yamlContent) as Record<string, unknown>
  const withEnv = applyEnvOverrides(raw)
  return EvalConfigSchema.parse(withEnv)
}
