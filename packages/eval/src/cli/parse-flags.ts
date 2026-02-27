/**
 * Parses --flag <value> pairs from an argv array.
 * Returns the value string, or null if the flag is absent or has no value.
 */
export function parseFlag(argv: readonly string[], flag: string): string | null {
  const idx = argv.indexOf(flag)
  if (idx === -1) return null
  const next = argv[idx + 1]
  if (next === undefined || next.startsWith("--")) return null
  return next
}

/**
 * Parses a repeatable --flag <value> collecting all occurrences.
 * Returns an array of all values found.
 */
export function parseFlagAll(argv: readonly string[], flag: string): readonly string[] {
  const values: string[] = []
  for (let i = 0; i < argv.length - 1; i++) {
    const next = argv[i + 1]
    if (argv[i] === flag && next !== undefined && !next.startsWith("--")) {
      values.push(next)
    }
  }
  return values
}

/**
 * Returns true if a boolean flag is present in argv.
 */
export function hasFlag(argv: readonly string[], flag: string): boolean {
  return argv.includes(flag)
}
