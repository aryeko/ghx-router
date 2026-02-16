import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { createColors } from "colorette"
import { createLogUpdate } from "log-update"
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
  verbose: boolean
}

type ExitResult = {
  code: number
  signal: NodeJS.Signals | null
  command: string
  stdoutTail: string[]
  stderrTail: string[]
}

type ProgressEvent = {
  completed: number
  total: number
}

type BenchmarkStatus = "pending" | "starting" | "running" | "ok" | "failed"
type PhaseStatus = "pending" | "running" | "ok" | "failed"
type PhaseName = "cleanup" | "seed" | "benchmark" | "report" | "gate"

type BenchmarkRow = {
  status: BenchmarkStatus
  completed: number
  total: number | null
}

type BenchmarkProgressSink = {
  start: (label: "ghx" | "direct") => void
  update: (label: "ghx" | "direct", event: ProgressEvent) => void
  complete: (label: "ghx" | "direct", status: "ok" | "failed") => void
}

type SuiteDashboard = {
  setPlan: (phases: PhaseName[]) => void
  startPhase: (phase: PhaseName) => void
  completePhase: (phase: PhaseName, status: "ok" | "failed") => void
  benchmark: BenchmarkProgressSink
  stop: () => void
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const BENCHMARK_LABEL_ORDER: Array<"ghx" | "direct"> = ["ghx", "direct"]
const TAIL_LIMIT = 12

const colors = createColors({
  useColor: Boolean(process.stdout.isTTY) && !process.env.NO_COLOR,
})

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
  const runGate = normalized.includes("--gate")
    ? true
    : normalized.includes("--no-gate")
      ? false
      : null
  const verbose = normalized.includes("--verbose")

  return {
    configPath,
    skipCleanup,
    skipSeed,
    runGate,
    verbose,
  }
}

export async function loadSuiteRunnerConfig(path: string): Promise<SuiteRunnerConfig> {
  const content = await readFile(path, "utf8")
  const parsed = JSON.parse(content) as unknown
  return suiteRunnerConfigSchema.parse(parsed)
}

function toBar(completed: number, total: number, width = 22): string {
  const safeTotal = total > 0 ? total : 1
  const ratio = Math.max(0, Math.min(1, completed / safeTotal))
  const filled = Math.round(ratio * width)
  return `${"#".repeat(filled)}${"-".repeat(width - filled)}`
}

function pushTail(tail: string[], value: string): void {
  tail.push(value)
  if (tail.length > TAIL_LIMIT) {
    tail.shift()
  }
}

function formatFailure(label: string, exit: ExitResult): string {
  const signal = exit.signal ? ` signal=${exit.signal}` : ""
  const stderr = exit.stderrTail.join("\n")
  const stdout = exit.stdoutTail.join("\n")
  const details = stderr || stdout

  if (!details) {
    return `${label} phase failed (code=${exit.code}${signal})\ncommand: ${exit.command}`
  }

  return `${label} phase failed (code=${exit.code}${signal})\ncommand: ${exit.command}\nrecent output:\n${details}`
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

  const eventName = (parsed as { event?: unknown }).event
  if (
    eventName !== "suite_started" &&
    eventName !== "scenario_started" &&
    eventName !== "scenario_finished"
  ) {
    return null
  }

  const completed = (parsed as { completed?: unknown }).completed
  const total = (parsed as { total?: unknown }).total

  if (typeof completed !== "number" || typeof total !== "number") {
    return null
  }

  return {
    completed,
    total,
  }
}

function renderPhaseIcon(status: PhaseStatus): string {
  if (status === "ok") return colors.green("✓")
  if (status === "failed") return colors.red("✗")
  if (status === "running") return colors.yellow("…")
  return colors.dim("○")
}

function renderBenchmarkRow(label: string, row: BenchmarkRow, spinnerFrame: string): string {
  const paddedLabel = label.padEnd(7)
  const colorizedLabel = label === "ghx" ? colors.blue(paddedLabel) : colors.magenta(paddedLabel)
  const status =
    row.status === "ok"
      ? colors.green("✓")
      : row.status === "failed"
        ? colors.red("✗")
        : row.status === "pending"
          ? colors.dim("○")
          : colors.yellow(spinnerFrame)

  if (row.status === "pending") {
    return `  ${colorizedLabel} ${status} ${colors.dim("pending")}`
  }

  if (!row.total || row.total <= 0) {
    return `  ${colorizedLabel} ${status} ${colors.dim("starting")}`
  }

  const completed = Math.min(Math.max(0, row.completed), row.total)
  const bar = `[${toBar(completed, row.total, 18)}]`
  return `  ${colorizedLabel} ${status} ${colors.cyan(bar)} ${colors.bold(`${completed}/${row.total}`)}`
}

function createSuiteDashboard(verbose: boolean): SuiteDashboard {
  const tty = Boolean(process.stdout.isTTY)

  if (!tty || verbose) {
    const phaseStatus = new Map<PhaseName, PhaseStatus>()

    return {
      setPlan: (phases) => {
        for (const phase of phases) {
          phaseStatus.set(phase, "pending")
        }
      },
      startPhase: (phase) => {
        phaseStatus.set(phase, "running")
        if (!verbose) {
          console.log(`[suite] ${phase} started`)
        }
      },
      completePhase: (phase, status) => {
        phaseStatus.set(phase, status)
        if (!verbose) {
          console.log(`[suite] ${phase} ${status === "ok" ? "done" : "failed"}`)
        }
      },
      benchmark: {
        start: (label) => {
          if (!verbose) {
            console.log(`[benchmark] ${label} started`)
          }
        },
        update: (label, event) => {
          if (!verbose) {
            console.log(`[benchmark] ${label} ${event.completed}/${event.total}`)
          }
        },
        complete: (label, status) => {
          if (!verbose) {
            console.log(`[benchmark] ${label} ${status}`)
          }
        },
      },
      stop: () => undefined,
    }
  }

  const logUpdate = createLogUpdate(process.stdout)
  const phases: PhaseName[] = []
  const phaseStatus = new Map<PhaseName, PhaseStatus>()
  const benchmarkRows = new Map<"ghx" | "direct", BenchmarkRow>()
  let spinnerIndex = 0

  const render = () => {
    if (phases.length === 0) {
      return
    }

    const spinnerFrame = SPINNER_FRAMES[spinnerIndex % SPINNER_FRAMES.length] ?? "*"

    let progressComplete = 0
    for (const phase of phases) {
      const status = phaseStatus.get(phase) ?? "pending"
      if (status === "ok" || status === "failed") {
        progressComplete += 1
        continue
      }

      if (phase === "benchmark" && status === "running") {
        const ratios = BENCHMARK_LABEL_ORDER.map((label) => {
          const row = benchmarkRows.get(label)
          if (!row || !row.total || row.total <= 0) {
            return 0
          }
          return Math.min(Math.max(0, row.completed / row.total), 1)
        })
        const avg =
          ratios.length === 0 ? 0 : ratios.reduce((sum, value) => sum + value, 0) / ratios.length
        progressComplete += avg
      }
      break
    }

    const ratio = phases.length === 0 ? 0 : progressComplete / phases.length
    const lines: string[] = []
    lines.push(
      `${colors.cyan("[suite]")} ${colors.cyan(`[${toBar(Math.round(ratio * 100), 100)}]`)} ${colors.bold(`${(ratio * 100).toFixed(1)}%`)}`,
    )

    for (const phase of phases) {
      const status = phaseStatus.get(phase) ?? "pending"
      lines.push(`${renderPhaseIcon(status)} ${phase}`)
      if (phase === "benchmark") {
        for (const label of BENCHMARK_LABEL_ORDER) {
          const row = benchmarkRows.get(label) ?? {
            status: "pending",
            completed: 0,
            total: null,
          }
          lines.push(renderBenchmarkRow(label, row, spinnerFrame))
        }
      }
    }

    logUpdate(lines.join("\n"))
  }

  const interval = setInterval(() => {
    spinnerIndex += 1
    render()
  }, 120)
  interval.unref()

  return {
    setPlan: (nextPhases) => {
      phases.length = 0
      phases.push(...nextPhases)
      for (const phase of nextPhases) {
        phaseStatus.set(phase, "pending")
      }
      for (const label of BENCHMARK_LABEL_ORDER) {
        benchmarkRows.set(label, {
          status: "pending",
          completed: 0,
          total: null,
        })
      }
      render()
    },
    startPhase: (phase) => {
      phaseStatus.set(phase, "running")
      render()
    },
    completePhase: (phase, status) => {
      phaseStatus.set(phase, status)
      render()
    },
    benchmark: {
      start: (label) => {
        const existing = benchmarkRows.get(label)
        benchmarkRows.set(label, {
          status: "starting",
          completed: existing?.completed ?? 0,
          total: existing?.total ?? null,
        })
        render()
      },
      update: (label, event) => {
        const existing = benchmarkRows.get(label)
        const total = event.total > 0 ? event.total : (existing?.total ?? null)
        benchmarkRows.set(label, {
          status: "running",
          completed: event.completed,
          total,
        })
        render()
      },
      complete: (label, status) => {
        const existing = benchmarkRows.get(label)
        benchmarkRows.set(label, {
          status,
          completed:
            status === "ok" && existing?.total ? existing.total : (existing?.completed ?? 0),
          total: existing?.total ?? null,
        })
        render()
      },
    },
    stop: () => {
      clearInterval(interval)
      render()
      logUpdate.done()
    },
  }
}

function streamChildOutput(
  source: NodeJS.ReadableStream,
  onLine: (line: string) => boolean,
  writeLine: (line: string) => void,
  pushTailLine: (line: string) => void,
): void {
  let buffer = ""
  source.on("data", (chunk: Buffer | string) => {
    buffer += chunk.toString()
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) {
        continue
      }

      pushTailLine(line)
      const handled = onLine(line)
      if (!handled) {
        writeLine(line)
      }
    }
  })

  source.on("end", () => {
    const line = buffer.trim()
    if (!line) {
      return
    }

    pushTailLine(line)
    const handled = onLine(line)
    if (!handled) {
      writeLine(line)
    }
  })
}

function spawnCommand(
  label: string,
  command: CommandConfig,
  options?: {
    cwd?: string
    env?: Record<string, string>
    benchmarkProgress?: BenchmarkProgressSink
    streamOutput?: boolean
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

  const stdoutTail: string[] = []
  const stderrTail: string[] = []
  const commandString = [commandName, ...commandArgs].join(" ")

  const benchmarkProgress = options?.benchmarkProgress
  if (benchmarkProgress && (label === "ghx" || label === "direct")) {
    benchmarkProgress.start(label)
  }

  streamChildOutput(
    child.stdout,
    (line) => {
      if (!benchmarkProgress || (label !== "ghx" && label !== "direct")) {
        return false
      }

      const event = parseProgressEvent(line)
      if (!event) {
        return false
      }

      benchmarkProgress.update(label, event)
      return true
    },
    (line) => {
      if (options?.streamOutput) {
        console.log(`[${label}] ${line}`)
      }
    },
    (line) => pushTail(stdoutTail, line),
  )

  streamChildOutput(
    child.stderr,
    () => false,
    (line) => {
      if (options?.streamOutput) {
        console.error(`[${label}] ${line}`)
      }
    },
    (line) => pushTail(stderrTail, line),
  )

  const done = new Promise<ExitResult>((resolveDone) => {
    let settled = false

    const settle = (result: ExitResult): void => {
      if (!settled) {
        settled = true
        resolveDone(result)
      }
    }

    child.once("error", (error) => {
      pushTail(stderrTail, error instanceof Error ? error.message : String(error))
      settle({ code: 1, signal: null, command: commandString, stdoutTail, stderrTail })
    })

    child.once("exit", (code, signal) => {
      settle({ code: code ?? 1, signal, command: commandString, stdoutTail, stderrTail })
    })
  })

  return {
    child,
    done,
  }
}

function buildBenchmarkCommand(
  base: BenchmarkBaseConfig,
  variant: BenchmarkVariantConfig,
): CommandConfig {
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

async function runPhase(
  label: Exclude<PhaseName, "benchmark">,
  command: CommandConfig,
  dashboard: SuiteDashboard,
  options: {
    cwd?: string
    verbose: boolean
  },
): Promise<void> {
  dashboard.startPhase(label)

  const run = spawnCommand(label, command, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    streamOutput: options.verbose,
  })
  const exit = await run.done

  if (exit.code !== 0) {
    dashboard.completePhase(label, "failed")
    throw new Error(formatFailure(label, exit))
  }

  dashboard.completePhase(label, "ok")
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
  dashboard: SuiteDashboard,
  options: {
    cwd?: string
  },
): Promise<void> {
  dashboard.startPhase("benchmark")

  const sharedEnv = {
    BENCH_PROGRESS_EVENTS: "jsonl",
  }

  const ghxCommand = buildBenchmarkCommand(benchmark.base, benchmark.ghx)
  const directCommand = buildBenchmarkCommand(benchmark.base, benchmark.direct)

  const ghx = spawnCommand("ghx", ghxCommand, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: sharedEnv,
    benchmarkProgress: dashboard.benchmark,
  })

  const direct = spawnCommand("direct", directCommand, {
    ...(options.cwd ? { cwd: options.cwd } : {}),
    env: sharedEnv,
    benchmarkProgress: dashboard.benchmark,
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
  }

  const ghxDone = ghx.done.then((result) => {
    dashboard.benchmark.complete("ghx", result.code === 0 ? "ok" : "failed")
    maybeTerminatePeer("ghx", result, direct)
    return result
  })

  const directDone = direct.done.then((result) => {
    dashboard.benchmark.complete("direct", result.code === 0 ? "ok" : "failed")
    maybeTerminatePeer("direct", result, ghx)
    return result
  })

  const [ghxResult, directResult] = await Promise.all([ghxDone, directDone])

  if (ghxResult.code !== 0 || directResult.code !== 0) {
    dashboard.completePhase("benchmark", "failed")

    const failed =
      ghxResult.code !== 0
        ? { label: "ghx", result: ghxResult }
        : { label: "direct", result: directResult }
    throw new Error(formatFailure(failed.label, failed.result))
  }

  dashboard.completePhase("benchmark", "ok")
}

function buildExecutionPlan(config: SuiteRunnerConfig, parsed: ParsedArgs): PhaseName[] {
  const phases: PhaseName[] = []

  const setup = config.fixtures?.setup
  if (setup?.cleanup && !parsed.skipCleanup) {
    phases.push("cleanup")
  }

  if (setup?.seed && !parsed.skipSeed) {
    phases.push("seed")
  }

  phases.push("benchmark")
  phases.push("report")

  const shouldRunGate =
    parsed.runGate === null ? Boolean(config.reporting.analysis.gate) : parsed.runGate
  if (shouldRunGate) {
    phases.push("gate")
  }

  return phases
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv)
  const resolvedConfigPath = resolve(parsed.configPath)
  const config = await loadSuiteRunnerConfig(resolvedConfigPath)
  const cwd = config.cwd ? resolve(config.cwd) : undefined
  const generatedSeedId = `suite-seed-${Date.now()}`

  const dashboard = createSuiteDashboard(parsed.verbose)
  const phases = buildExecutionPlan(config, parsed)
  dashboard.setPlan(phases)

  try {
    const setup = config.fixtures?.setup
    if (setup?.cleanup && !parsed.skipCleanup) {
      await runPhase("cleanup", setup.cleanup, dashboard, {
        ...(cwd ? { cwd } : {}),
        verbose: parsed.verbose,
      })
    }

    if (setup?.seed && !parsed.skipSeed) {
      await runPhase("seed", ensureSeedEnv(setup.seed, generatedSeedId), dashboard, {
        ...(cwd ? { cwd } : {}),
        verbose: parsed.verbose,
      })
    }

    await runParallelBenchmarks(config.benchmark, dashboard, {
      ...(cwd ? { cwd } : {}),
    })

    await runPhase("report", config.reporting.analysis.report, dashboard, {
      ...(cwd ? { cwd } : {}),
      verbose: parsed.verbose,
    })

    const gateConfig = config.reporting.analysis.gate
    const shouldRunGate = parsed.runGate === null ? Boolean(gateConfig) : parsed.runGate
    if (shouldRunGate) {
      if (!gateConfig) {
        throw new Error("Gate requested but no gate command configured")
      }

      await runPhase("gate", gateConfig, dashboard, {
        ...(cwd ? { cwd } : {}),
        verbose: parsed.verbose,
      })
    }
  } finally {
    dashboard.stop()
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
