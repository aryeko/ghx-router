import { z } from "zod"
import type { BenchmarkMode } from "../domain/types.js"
import { parseFlagValue, parseMultiFlagValues, parseStrictFlagValue } from "./flag-utils.js"

export type ParsedCliArgs = {
  command: "run"
  mode: BenchmarkMode
  repetitions: number
  scenarioFilter: string[] | null
  scenarioSet: string | null
  fixtureManifestPath: string | null
  seedIfMissing: boolean
  providerId: string | null
  modelId: string | null
  outputJsonlPath: string | null
  skipWarmup: boolean
}

function isBenchmarkMode(value: string): boolean {
  return ["agent_direct", "mcp", "ghx"].includes(value)
}

function stripForwardingSeparator(args: string[]): string[] {
  return args.filter((arg) => arg !== "--")
}

function splitPositionalAndFlags(args: string[]): {
  positional: string[]
  flags: string[]
} {
  const positional: string[] = []
  const flags: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]
    if (!current) {
      continue
    }

    if (current.startsWith("--")) {
      flags.push(current)
      if (!current.includes("=")) {
        const next = args[index + 1]
        if (typeof next === "string" && !next.startsWith("--")) {
          flags.push(next)
          index += 1
        }
      }
      continue
    }

    positional.push(current)
  }

  return { positional, flags }
}

function parseSeedIfMissing(flags: string[]): boolean {
  return flags.includes("--seed-if-missing")
}

function parseSkipWarmup(flags: string[]): boolean {
  return flags.includes("--skip-warmup")
}

const parsedCliArgsSchema = z
  .object({
    command: z.literal("run"),
    mode: z.enum(["agent_direct", "mcp", "ghx"]),
    repetitions: z.number().int().min(1),
    scenarioFilter: z.array(z.string().min(1)).min(1).nullable(),
    scenarioSet: z.string().min(1).nullable(),
    fixtureManifestPath: z.string().min(1).nullable(),
    seedIfMissing: z.boolean(),
    providerId: z.string().min(1).nullable(),
    modelId: z.string().min(1).nullable(),
    outputJsonlPath: z.string().min(1).nullable(),
    skipWarmup: z.boolean(),
  })
  .refine((value) => !(value.scenarioFilter && value.scenarioSet), {
    message: "--scenario and --scenario-set cannot be used together",
  })

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const normalized = stripForwardingSeparator(argv)
  const [maybeCommand, ...rest] = normalized
  const command = maybeCommand === "run" || !maybeCommand ? "run" : maybeCommand

  if (command !== "run") {
    throw new Error(`Unsupported command: ${command}`)
  }

  const { positional, flags } = splitPositionalAndFlags(rest)
  const [modeRaw = "ghx", repetitionsRaw = "1"] = positional
  const mode = modeRaw

  if (!isBenchmarkMode(mode)) {
    throw new Error(`Unsupported mode: ${mode}`)
  }

  const repetitions = Number(repetitionsRaw)
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error(`Invalid repetitions: ${repetitionsRaw}`)
  }

  const scenarioValues = parseMultiFlagValues(flags, "--scenario")
  const scenarioFilter = scenarioValues.length > 0 ? scenarioValues : null

  const parsed = parsedCliArgsSchema.parse({
    command,
    mode,
    repetitions,
    scenarioFilter,
    scenarioSet: parseFlagValue(flags, "--scenario-set"),
    fixtureManifestPath: parseFlagValue(flags, "--fixture-manifest"),
    seedIfMissing: parseSeedIfMissing(flags),
    providerId: parseStrictFlagValue(flags, "--provider"),
    modelId: parseStrictFlagValue(flags, "--model"),
    outputJsonlPath: parseStrictFlagValue(flags, "--output-jsonl"),
    skipWarmup: parseSkipWarmup(flags),
  })

  return parsed
}
