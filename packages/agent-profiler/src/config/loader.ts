import { readFile } from "node:fs/promises"
import yaml from "js-yaml"
import type { ProfilerConfig } from "./schema.js"
import { ProfilerConfigSchema } from "./schema.js"

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
}

function preprocessKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(preprocessKeys)
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[snakeToCamel(key)] = preprocessKeys(value)
    }
    return result
  }
  return obj
}

/**
 * Load and validate a profiler configuration from a YAML file.
 *
 * Snake_case keys in the YAML are automatically converted to camelCase before
 * schema validation. Throws a Zod validation error if the file content does not
 * conform to ProfilerConfigSchema.
 *
 * @param yamlPath - Absolute path to the YAML configuration file.
 * @returns The validated and fully defaulted ProfilerConfig.
 */
export async function loadConfig(yamlPath: string): Promise<ProfilerConfig> {
  let content: string
  try {
    content = await readFile(yamlPath, "utf-8")
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to read config file "${yamlPath}": ${message}`)
  }

  let raw: unknown
  try {
    raw = yaml.load(content)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to parse YAML in "${yamlPath}": ${message}`)
  }

  const preprocessed = preprocessKeys(raw)
  return ProfilerConfigSchema.parse(preprocessed) as ProfilerConfig
}

/**
 * Map of supported CLI flag names to their human-readable descriptions.
 * Used to generate help text in the CLI entry point.
 */
export const PROFILER_FLAGS = {
  "--mode": "Override modes (repeatable)",
  "--scenario": "Override scenarios (repeatable)",
  "--scenario-set": "Override scenario set",
  "--repetitions": "Override repetition count",
  "--retries": "Override allowed retries per iteration",
  "--skip-warmup": "Skip warmup canary",
} as const

/**
 * Apply CLI flag overrides on top of a base ProfilerConfig.
 *
 * Parses the `argv` array for recognized flags and merges any provided values
 * into the corresponding fields of `base`. Unrecognized flags are silently ignored.
 *
 * @param argv - Raw CLI argument array (typically `process.argv.slice(2)`).
 * @param base - The base configuration to apply overrides to.
 * @returns A new ProfilerConfig with CLI overrides applied immutably.
 */
export function parseProfilerFlags(argv: readonly string[], base: ProfilerConfig): ProfilerConfig {
  const modes: string[] = []
  const scenarioIds: string[] = []
  let scenarioSet: string | undefined
  let repetitions: number | undefined
  let allowedRetries: number | undefined
  let skipWarmup = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]
    switch (arg) {
      case "--mode":
        if (!next || next.startsWith("--")) {
          throw new Error("--mode requires a value")
        }
        modes.push(next)
        i++
        break
      case "--scenario":
        if (!next || next.startsWith("--")) {
          throw new Error("--scenario requires a value")
        }
        scenarioIds.push(next)
        i++
        break
      case "--scenario-set":
        if (!next || next.startsWith("--")) {
          throw new Error("--scenario-set requires a value")
        }
        scenarioSet = next
        i++
        break
      case "--repetitions": {
        if (!next || next.startsWith("--")) {
          throw new Error("--repetitions requires a numeric value")
        }
        const parsedReps = Number.parseInt(next, 10)
        if (Number.isNaN(parsedReps) || parsedReps < 1) {
          throw new Error(`--repetitions requires a positive integer, got: ${next}`)
        }
        repetitions = parsedReps
        i++
        break
      }
      case "--retries": {
        if (!next || next.startsWith("--")) {
          throw new Error("--retries requires a numeric value")
        }
        const parsedRetries = Number.parseInt(next, 10)
        if (Number.isNaN(parsedRetries) || parsedRetries < 0) {
          throw new Error(`--retries requires a non-negative integer, got: ${next}`)
        }
        allowedRetries = parsedRetries
        i++
        break
      }
      case "--skip-warmup":
        skipWarmup = true
        break
    }
  }

  return {
    ...base,
    ...(modes.length > 0 ? { modes } : {}),
    scenarios: {
      ...base.scenarios,
      ...(scenarioIds.length > 0 ? { ids: scenarioIds } : {}),
      ...(scenarioSet !== undefined ? { set: scenarioSet } : {}),
    },
    execution: {
      ...base.execution,
      ...(repetitions !== undefined ? { repetitions } : {}),
      ...(allowedRetries !== undefined ? { allowedRetries } : {}),
      ...(skipWarmup ? { warmup: false } : {}),
    },
  }
}
