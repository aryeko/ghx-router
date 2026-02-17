/**
 * Parses a single optional string flag from CLI args.
 * Supports both `--flag value` and `--flag=value` forms.
 * Returns null if the flag is absent, the next arg is missing, or the next arg is another flag.
 */
export function parseFlagValue(args: string[], flag: string): string | null {
  const index = args.findIndex((arg) => arg === flag)
  if (index !== -1) {
    const value = (args[index + 1] ?? "").trim()
    if (value.length === 0 || value.startsWith("--")) {
      return null
    }
    return value
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) {
    const value = inline.slice(flag.length + 1).trim()
    if (value.length === 0) {
      return null
    }
    return value
  }

  return null
}

/**
 * Parses an optional string flag strictly from CLI args.
 * Returns null if the flag is absent.
 * Throws if the flag is present but its value is missing or empty.
 */
export function parseStrictFlagValue(args: string[], flag: string): string | null {
  const index = args.findIndex((arg) => arg === flag)
  if (index !== -1) {
    const value = (args[index + 1] ?? "").trim()
    if (value.length === 0 || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`)
    }
    return value
  }

  const inline = args.find((arg) => arg.startsWith(`${flag}=`))
  if (inline) {
    const value = inline.slice(flag.length + 1).trim()
    if (value.length === 0) {
      throw new Error(`Missing value for ${flag}`)
    }
    return value
  }

  return null
}

/**
 * Parses a required string flag from CLI args.
 * Throws if the flag is absent or its value is missing/empty.
 */
export function parseRequiredFlag(args: string[], flag: string): string {
  const value = parseFlagValue(args, flag)
  if (value === null) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

/**
 * Collects all values for a repeatable flag (e.g. `--scenario-id a --scenario-id b`).
 * Returns an empty array if the flag never appears.
 */
export function parseMultiFlagValues(args: string[], flag: string): string[] {
  const values: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]
    if (!current) continue

    if (current === flag) {
      const next = (args[index + 1] ?? "").trim()
      if (next.length === 0 || next.startsWith("--")) {
        throw new Error(`Missing value for ${flag}`)
      }
      values.push(next)
      index += 1
      continue
    }

    const inlinePrefix = `${flag}=`
    if (current.startsWith(inlinePrefix)) {
      const value = current.slice(inlinePrefix.length).trim()
      if (value.length === 0) {
        throw new Error(`Missing value for ${flag}`)
      }
      values.push(value)
    }
  }

  return values
}

/**
 * Returns true if the flag is present (bare boolean flag).
 */
export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag)
}
