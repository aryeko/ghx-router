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
