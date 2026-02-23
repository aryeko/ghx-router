import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { sanitizeTelemetryContext } from "./logger.js"

declare const __GHX_VERSION__: string

const LOG_LEVELS = ["debug", "info", "warn", "error"] as const
type LogLevel = (typeof LOG_LEVELS)[number]

type LoggerConfig = {
  level: LogLevel | "off"
  dir: string
  pid: number
  ppid: number
}

interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void
  info(msg: string, ctx?: Record<string, unknown>): void
  warn(msg: string, ctx?: Record<string, unknown>): void
  error(msg: string, ctx?: Record<string, unknown>): void
}

function resolveLevel(raw: string | undefined): LogLevel | "off" {
  if (!raw) return "off"
  const normalized = raw.toLowerCase()
  if ((LOG_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as LogLevel
  }
  return "info"
}

export function buildLogFilePath(dir: string, date: Date): string {
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(date.getUTCDate()).padStart(2, "0")
  return path.join(dir, `ghx-${yyyy}-${mm}-${dd}.jsonl`)
}

export function createLoggerConfig(): LoggerConfig {
  const rawDir = process.env.GHX_LOG_DIR ?? path.join(os.homedir(), ".ghx", "logs")
  return {
    level: resolveLevel(process.env.GHX_LOG_LEVEL),
    dir: rawDir,
    pid: process.pid,
    ppid: process.ppid,
  }
}

function levelIndex(level: LogLevel | "off"): number {
  if (level === "off") return LOG_LEVELS.length
  return LOG_LEVELS.indexOf(level)
}

export function createLogger(config: LoggerConfig): Logger {
  if (config.level === "off") {
    return {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    }
  }

  const minIndex = levelIndex(config.level)
  let dirReady: Promise<void> | null = null

  function ensureDir(): Promise<void> {
    if (dirReady !== null) return dirReady
    // Errors are swallowed intentionally: this is fire-and-forget telemetry;
    // if the directory can't be created, subsequent writes will fail silently too.
    dirReady = fs.promises
      .mkdir(config.dir, { recursive: true })
      .then(() => undefined)
      .catch(() => undefined)
    return dirReady
  }

  function write(level: LogLevel, msg: string, ctx?: Record<string, unknown>): void {
    if (levelIndex(level) < minIndex) return

    const version = typeof __GHX_VERSION__ !== "undefined" ? __GHX_VERSION__ : "unknown"

    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      pid: config.pid,
      ppid: config.ppid,
      level,
      version,
      msg,
      ...(ctx
        ? sanitizeTelemetryContext(ctx as Parameters<typeof sanitizeTelemetryContext>[0])
        : {}),
    }

    const line = `${JSON.stringify(entry)}\n`
    const filePath = buildLogFilePath(config.dir, new Date())

    // fire-and-forget — never block execution
    ensureDir().then(() => {
      fs.appendFile(filePath, line, () => undefined)
    })
  }

  return {
    debug: (msg, ctx) => write("debug", msg, ctx),
    info: (msg, ctx) => write("info", msg, ctx),
    warn: (msg, ctx) => write("warn", msg, ctx),
    error: (msg, ctx) => write("error", msg, ctx),
  }
}

export const logger: Logger = createLogger(createLoggerConfig())
