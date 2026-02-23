import * as path from "node:path"

export type IterLogContext = {
  iterDir: string
}

export type IterLogContextConfig = {
  benchLogsDir: string
  benchRunTs: string
  mode: string
  scenarioId: string
  iteration: number
}

export type EnvPatch = {
  GHX_LOG_DIR: string
  GHX_LOG_LEVEL: string
}

export type EnvRestore = {
  GHX_LOG_DIR: string | undefined
  GHX_LOG_LEVEL: string | undefined
}

export function sanitizeBenchRunTs(ts: string): string {
  return ts.replace(/[:.]/g, "-")
}

export function buildBenchRunTs(date: Date = new Date()): string {
  return sanitizeBenchRunTs(date.toISOString())
}

export function buildIterDir(config: IterLogContextConfig): string {
  // benchRunTs is sanitized ISO: "2026-02-23T14-30-00-000Z" — first 10 chars give "YYYY-MM-DD"
  const date = config.benchRunTs.slice(0, 10)
  return path.join(
    config.benchLogsDir,
    date,
    config.benchRunTs,
    config.mode,
    config.scenarioId,
    `iter-${config.iteration}`,
  )
}

export function applyEnvPatch(patch: EnvPatch): EnvRestore {
  const restore: EnvRestore = {
    GHX_LOG_DIR: process.env.GHX_LOG_DIR,
    GHX_LOG_LEVEL: process.env.GHX_LOG_LEVEL,
  }
  process.env.GHX_LOG_DIR = patch.GHX_LOG_DIR
  process.env.GHX_LOG_LEVEL = patch.GHX_LOG_LEVEL
  return restore
}

export function restoreEnvPatch(restore: EnvRestore): void {
  if (restore.GHX_LOG_DIR === undefined) {
    delete process.env.GHX_LOG_DIR
  } else {
    process.env.GHX_LOG_DIR = restore.GHX_LOG_DIR
  }
  if (restore.GHX_LOG_LEVEL === undefined) {
    delete process.env.GHX_LOG_LEVEL
  } else {
    process.env.GHX_LOG_LEVEL = restore.GHX_LOG_LEVEL
  }
}
