import type { BenchmarkMode } from "../domain/types.js"
import { z } from "zod"

export type ParsedCliArgs = {
  command: "run"
  mode: BenchmarkMode
  repetitions: number
  scenarioFilter: string | null
  scenarioSet: string | null
}

function isBenchmarkMode(value: string): boolean {
  return ["agent_direct", "mcp", "ghx", "ghx_router"].includes(value)
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

function parseScenarioFilter(flags: string[]): string | null {
  const index = flags.findIndex((arg) => arg === "--scenario")
  if (index !== -1) {
    return flags[index + 1] ?? null
  }

  const inline = flags.find((arg) => arg.startsWith("--scenario="))
  if (inline) {
    return inline.slice("--scenario=".length)
  }

  return null
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

const parsedCliArgsSchema = z
  .object({
    command: z.literal("run"),
    mode: z.enum(["agent_direct", "mcp", "ghx"]),
    repetitions: z.number().int().min(1),
    scenarioFilter: z.string().min(1).nullable(),
    scenarioSet: z.string().min(1).nullable()
  })
  .refine((value) => !(value.scenarioFilter && value.scenarioSet), {
    message: "--scenario and --scenario-set cannot be used together"
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
  const mode = modeRaw === "ghx_router" ? "ghx" : modeRaw

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
    scenarioSet: parseScenarioSet(flags)
  })

  return parsed
}
