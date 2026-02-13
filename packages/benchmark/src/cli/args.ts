import type { BenchmarkMode } from "../domain/types.js"

export type ParsedCliArgs = {
  command: "run"
  mode: BenchmarkMode
  repetitions: number
  scenarioFilter: string | null
}

function isBenchmarkMode(value: string): value is BenchmarkMode {
  return ["agent_direct", "mcp", "ghx_router"].includes(value)
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

export function parseCliArgs(argv: string[]): ParsedCliArgs {
  const normalized = stripForwardingSeparator(argv)
  const [maybeCommand, ...rest] = normalized
  const command = maybeCommand === "run" || !maybeCommand ? "run" : maybeCommand

  if (command !== "run") {
    throw new Error(`Unsupported command: ${command}`)
  }

  const { positional, flags } = splitPositionalAndFlags(rest)
  const [modeRaw = "ghx_router", repetitionsRaw = "1"] = positional
  const mode = modeRaw

  if (!isBenchmarkMode(mode)) {
    throw new Error(`Unsupported mode: ${mode}`)
  }

  const repetitions = Number(repetitionsRaw)
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error(`Invalid repetitions: ${repetitionsRaw}`)
  }

  return {
    command,
    mode,
    repetitions,
    scenarioFilter: parseScenarioFilter(flags)
  }
}
