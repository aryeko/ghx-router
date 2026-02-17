import { z } from "zod"
import type { BenchmarkMode } from "../domain/types.js"

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

function parseScenarioFilter(flags: string[]): string[] | null {
  const values: string[] = []
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index]
    if (!flag) {
      continue
    }

    if (flag === "--scenario") {
      const value = flags[index + 1]
      if (value && !value.startsWith("--")) {
        values.push(value)
      }
      continue
    }

    if (flag.startsWith("--scenario=")) {
      const value = flag.slice("--scenario=".length)
      if (value.length > 0) {
        values.push(value)
      }
    }
  }

  if (values.length === 0) {
    return null
  }

  return values
}

function parseScenarioSet(flags: string[]): string | null {
  const index = flags.findIndex((arg) => arg === "--scenario-set")
  if (index !== -1) {
    return flags[index + 1] ?? null
  }

  const inline = flags.find((arg) => arg.startsWith("--scenario-set="))
  if (inline) {
    return inline.slice("--scenario-set=".length)
  }

  return null
}

function parseFixtureManifestPath(flags: string[]): string | null {
  const index = flags.findIndex((arg) => arg === "--fixture-manifest")
  if (index !== -1) {
    return flags[index + 1] ?? null
  }

  const inline = flags.find((arg) => arg.startsWith("--fixture-manifest="))
  if (inline) {
    return inline.slice("--fixture-manifest=".length)
  }

  return null
}

function parseSeedIfMissing(flags: string[]): boolean {
  return flags.includes("--seed-if-missing")
}

function parseSingleStringFlag(flags: string[], flagName: string): string | null {
  const index = flags.findIndex((arg) => arg === flagName)
  if (index !== -1) {
    const value = (flags[index + 1] ?? "").trim()
    if (value.length === 0 || value.startsWith("--")) {
      throw new Error(`Missing value for ${flagName}`)
    }
    return value
  }

  const inline = flags.find((arg) => arg.startsWith(`${flagName}=`))
  if (inline) {
    const value = inline.slice(flagName.length + 1).trim()
    if (value.length === 0) {
      throw new Error(`Missing value for ${flagName}`)
    }
    return value
  }

  return null
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

  const parsed = parsedCliArgsSchema.parse({
    command,
    mode,
    repetitions,
    scenarioFilter: parseScenarioFilter(flags),
    scenarioSet: parseScenarioSet(flags),
    fixtureManifestPath: parseFixtureManifestPath(flags),
    seedIfMissing: parseSeedIfMissing(flags),
    providerId: parseSingleStringFlag(flags, "--provider"),
    modelId: parseSingleStringFlag(flags, "--model"),
    outputJsonlPath: parseSingleStringFlag(flags, "--output-jsonl"),
  })

  return parsed
}
