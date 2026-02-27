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

export async function loadConfig(yamlPath: string): Promise<ProfilerConfig> {
  const content = await readFile(yamlPath, "utf-8")
  const raw = yaml.load(content)
  const preprocessed = preprocessKeys(raw)
  return ProfilerConfigSchema.parse(preprocessed) as ProfilerConfig
}

export const PROFILER_FLAGS = {
  "--mode": "Override modes (repeatable)",
  "--scenario": "Override scenarios (repeatable)",
  "--scenario-set": "Override scenario set",
  "--repetitions": "Override repetition count",
  "--retries": "Override allowed retries per iteration",
  "--skip-warmup": "Skip warmup canary",
  "--output-jsonl": "Write raw JSONL to specific file",
  "--dry-run": "Show what would be executed without running",
} as const

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
        if (next) {
          modes.push(next)
          i++
        }
        break
      case "--scenario":
        if (next) {
          scenarioIds.push(next)
          i++
        }
        break
      case "--scenario-set":
        if (next) {
          scenarioSet = next
          i++
        }
        break
      case "--repetitions":
        if (next) {
          repetitions = Number.parseInt(next, 10)
          i++
        }
        break
      case "--retries":
        if (next) {
          allowedRetries = Number.parseInt(next, 10)
          i++
        }
        break
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
