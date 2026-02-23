import type { BenchmarkRow } from "../domain/types.js"

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1] ?? 0
    const right = sorted[middle] ?? 0
    return (left + right) / 2
  }
  return sorted[middle] ?? 0
}

export function pct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return (numerator / denominator) * 100
}

export function safeReductionPct(baseline: number, target: number): number {
  if (baseline <= 0) return 0
  return ((baseline - target) / baseline) * 100
}

export function activeTokens(row: BenchmarkRow): number {
  return row.tokens.total - row.tokens.cache_read
}

export function isRunnerError(row: BenchmarkRow): boolean {
  return row.error?.type === "runner_error"
}
