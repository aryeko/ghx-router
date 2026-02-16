import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

import { z } from "zod"

const commandSchema = z.object({
  command: z.array(z.string().min(1)).min(1),
  env: z.record(z.string()).optional(),
})

const benchmarkBaseSchema = z.object({
  command: z.array(z.string().min(1)).min(1),
  repetitions: z.number().int().positive(),
  scenarioSet: z.string().min(1).optional(),
  env: z.record(z.string()).optional(),
})

const benchmarkVariantSchema = z.object({
  mode: z.enum(["ghx", "agent_direct"]),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
})

const suiteRunnerConfigSchema = z.object({
  fixtures: z
    .object({
      setup: z
        .object({
          cleanup: commandSchema.optional(),
          seed: commandSchema.optional(),
        })
        .optional(),
    })
    .optional(),
  benchmark: z.object({
    base: benchmarkBaseSchema,
    ghx: benchmarkVariantSchema,
    direct: benchmarkVariantSchema,
  }),
  reporting: z.object({
    analysis: z.object({
      report: commandSchema,
      gate: commandSchema.optional(),
    }),
  }),
  cwd: z.string().min(1).optional(),
})

type CommandConfig = z.infer<typeof commandSchema>
type SuiteRunnerConfig = z.infer<typeof suiteRunnerConfigSchema>
type BenchmarkBaseConfig = z.infer<typeof benchmarkBaseSchema>
type BenchmarkVariantConfig = z.infer<typeof benchmarkVariantSchema>

type ParsedArgs = {
  configPath: string
  skipCleanup: boolean
  skipSeed: boolean
  runGate: boolean | null
}

type ExitResult = {
  code: number
  signal: NodeJS.Signals | null
}

type ProgressEvent = {
  completed: number
  total: number
}

type ProgressSink = {
  start: (label: string) => void
  update: (label: string, event: ProgressEvent) => void
  complete: (label: string, status: "ok" | "failed") => void
  stop: () => void
}

function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.findIndex((arg) => arg === flag)
  if (index !== -1) {
    return args[index + 1] ?? null
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) {
    return inline.slice(flag.length + 1)
  }

  return null
}

export function parseArgs(argv: string[]): ParsedArgs {
  const normalized = argv.filter((arg) => arg !== "--")
  const configPath = parseFlagValue(normalized, "--config") ?? "config/suite-runner.json"
  const skipCleanup = normalized.includes("--skip-cleanup")
  const skipSeed = normalized.includes("--skip-seed")
  const runGate = normalized.includes("--gate") ? true : normalized.includes("--no-gate") ? false : null

  return {
    configPath,
    skipCleanup,
    skipSeed,
    runGate,
  }
}

export async function loadSuiteRunnerConfig(path: string): Promise<SuiteRunnerConfig> {
  const content = await readFile(path, "utf8")
  const parsed = JSON.parse(content) as unknown
  return suiteRunnerConfigSchema.parse(parsed)
}

function createProgressSink(): ProgressSink {
  const tty = Boolean(process.stdout.isTTY)
  const toBar = (completed: number, total: number): string => {
    const width = 20
    const safeTotal = total > 0 ? total : 1
    const ratio = Math.max(0, Math.min(1, completed / safeTotal))
    const filled = Math.round(ratio * width)
    return `${"#".repeat(filled)}${"-".repeat(width - filled)}`
  }

  if (!tty) {
    return {
      start: (label) => {
        console.log(`[benchmark] ${label} started`)
      },
      update: () => undefined,
      complete: (label, status) => {
        console.log(`[benchmark] ${label} ${status}`)
      },
      stop: () => undefined,
    }
  }

  const bars = new Map<string, ProgressEvent>()

  return {
    start: (label) => {
      if (!bars.has(label)) {
        bars.set(label, { completed: 0, total: 1 })
        console.log(`[benchmark] ${label} [${toBar(0, 1)}] 0/1`)
      }
    },
    update: (label, event) => {
      const total = event.total > 0 ? event.total : 1
      const value = Math.min(event.completed, total)
      bars.set(label, { completed: value, total })
      console.log(`[benchmark] ${label} [${toBar(value, total)}] ${value}/${total}`)
    },
    complete: (label, status) => {
      const progress = bars.get(label)
      if (progress && status === "ok") {
        console.log(
          `[benchmark] ${label} [${toBar(progress.total, progress.total)}] ${progress.total}/${progress.total}`,
        )
      }
      bars.delete(label)
      console.log(`[benchmark] ${label} ${status}`)
    },
    stop: () => undefined,
  }
}

function parseProgressEvent(payload: string): ProgressEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== "object") {
    return null
  }

  const maybeCompleted = (parsed as { completed?: unknown }).completed
  const maybeTotal = (parsed as { total?: unknown }).total

  if (typeof maybeCompleted === "number" && typeof maybeTotal === "number") {
    return {
      completed: maybeCompleted,
      total: maybeTotal,
    }
  }

  const row = (parsed as { row?: unknown }).row
  if (row && typeof row === "object") {
    const rowCompleted = (row as { completed?: unknown }).completed
    const rowTotal = (row as { total?: unknown }).total
    if (typeof rowCompleted === "number" && typeof rowTotal === "number") {
      return {
        completed: rowCompleted,
        total: rowTotal,
      }
    }
  }

  const event = (parsed as { event?: unknown }).event
  if (event === "scenario_finished") {
    const completed = (parsed as { completed?: unknown }).completed
    const total = (parsed as { total?: unknown }).total
    if (typeof completed === "number" && typeof total === "number") {
      return { completed, total }
    }
  }

  return null
}

function spawnCommand(
  label: string,
  command: CommandConfig,
  options?: {
    cwd?: string
    env?: Record<string, string>
    progressSink?: ProgressSink
  },
): {
  child: ReturnType<typeof spawn>
  done: Promise<ExitResult>
} {
  const [commandName, ...commandArgs] = command.command
  if (!commandName) {
    throw new Error(`${label} command is empty`)
  }

  const spawnOptions: {
    cwd?: string
    env: NodeJS.ProcessEnv
    stdio: ["ignore", "pipe", "pipe"]
  } = {
    env: {
      ...process.env,
      ...(command.env ?? {}),
      ...(options?.env ?? {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  }
  if (options?.cwd) {
    spawnOptions.cwd = options.cwd
  }

  const child = spawn(commandName, commandArgs, {
    ...spawnOptions,
  })

  const progressSink = options?.progressSink
  if (progressSink) {
    progressSink.start(label)

    let stdoutBuffer = ""
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString()
      const lines = stdoutBuffer.split("\n")
      stdoutBuffer = lines.pop() ?? ""

      for (const lineRaw of lines) {
        const line = lineRaw.trim()
        if (!line) {
          continue
        }

        const event = parseProgressEvent(line)
        if (event) {
          progressSink.update(label, event)
        }
      }
    })
  }

  const done = new Promise<ExitResult>((resolveDone) => {
    let settled = false

    const settle = (result: ExitResult): void => {
      if (!settled) {
        settled = true
        resolveDone(result)
      }
    }

    child.once("error", () => {
      settle({ code: 1, signal: null })
    })

    child.once("exit", (code, signal) => {
      settle({ code: code ?? 1, signal })
    })
  })

  return {
    child,
    done,
  }
}

function buildBenchmarkCommand(base: BenchmarkBaseConfig, variant: BenchmarkVariantConfig): CommandConfig {
  const args = [...base.command, variant.mode, String(base.repetitions)]
  if (base.scenarioSet) {
    args.push("--scenario-set", base.scenarioSet)
  }
  if (variant.args) {
    args.push(...variant.args)
  }

  return {
    command: args,
    env: {
      ...(base.env ?? {}),
      ...(variant.env ?? {}),
    },
  }
}

async function runPhase(label: string, command: CommandConfig, cwd?: string): Promise<void> {
  const run = spawnCommand(label, command, cwd ? { cwd } : undefined)
  const exit = await run.done

  if (exit.code !== 0) {
    throw new Error(`${label} phase failed with exit code ${exit.code}`)
  }
}

function ensureSeedEnv(command: CommandConfig, seedId: string): CommandConfig {
  if (command.env?.BENCH_FIXTURE_SEED_ID || process.env.BENCH_FIXTURE_SEED_ID) {
    return command
  }

  return {
    ...command,
    env: {
      ...(command.env ?? {}),
      BENCH_FIXTURE_SEED_ID: seedId,
    },
  }
}

async function runParallelBenchmarks(
  benchmark: SuiteRunnerConfig["benchmark"],
  cwd?: string,
): Promise<void> {
  const progress = createProgressSink()
  const sharedEnv = {
    BENCH_PROGRESS_EVENTS: "jsonl",
  }
  const baseOptions = cwd ? { cwd } : {}

  const ghxCommand = buildBenchmarkCommand(benchmark.base, benchmark.ghx)
  const directCommand = buildBenchmarkCommand(benchmark.base, benchmark.direct)

  const ghx = spawnCommand("ghx", ghxCommand, {
    ...baseOptions,
    env: sharedEnv,
    progressSink: progress,
  })
  const direct = spawnCommand("direct", directCommand, {
    ...baseOptions,
    env: sharedEnv,
    progressSink: progress,
  })

  let terminating = false

  const maybeTerminatePeer = (
    failedLabel: "ghx" | "direct",
    failedResult: ExitResult,
    peer: ReturnType<typeof spawnCommand>,
  ): void => {
    if (failedResult.code === 0 || terminating) {
      return
    }

    terminating = true
    peer.child.kill("SIGTERM")
    console.error(`[benchmark] ${failedLabel} failed with exit code ${failedResult.code}`)
  }

  const ghxDone = ghx.done.then((result) => {
    progress.complete("ghx", result.code === 0 ? "ok" : "failed")
    maybeTerminatePeer("ghx", result, direct)
    return result
  })

  const directDone = direct.done.then((result) => {
    progress.complete("direct", result.code === 0 ? "ok" : "failed")
    maybeTerminatePeer("direct", result, ghx)
    return result
  })

  const [ghxResult, directResult] = await Promise.all([ghxDone, directDone])
  progress.stop()

  if (ghxResult.code !== 0 || directResult.code !== 0) {
    throw new Error(
      `benchmark phase failed: ghx=${ghxResult.code}${ghxResult.signal ? ` (${ghxResult.signal})` : ""}, direct=${directResult.code}${directResult.signal ? ` (${directResult.signal})` : ""}`,
    )
  }
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv)
  const config = await loadSuiteRunnerConfig(resolve(parsed.configPath))
  const cwd = config.cwd ? resolve(config.cwd) : undefined
  const generatedSeedId = `suite-seed-${Date.now()}`

  const setup = config.fixtures?.setup
  if (setup?.cleanup && !parsed.skipCleanup) {
    await runPhase("cleanup", setup.cleanup, cwd)
  }

  if (setup?.seed && !parsed.skipSeed) {
    await runPhase("seed", ensureSeedEnv(setup.seed, generatedSeedId), cwd)
  }

  await runParallelBenchmarks(config.benchmark, cwd)
  await runPhase("report", config.reporting.analysis.report, cwd)

  const gateConfig = config.reporting.analysis.gate
  const shouldRunGate = parsed.runGate === null ? Boolean(gateConfig) : parsed.runGate
  if (shouldRunGate) {
    if (!gateConfig) {
      throw new Error("Gate requested but no gate command configured")
    }
    await runPhase("gate", gateConfig, cwd)
  }
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false

if (isDirectRun) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exit(1)
  })
}
