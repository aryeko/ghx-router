import { hasFlag, parseFlag, parseFlagAll } from "@eval/cli/parse-flags.js"
import { describe, expect, it } from "vitest"

describe("parseFlag", () => {
  it("returns the value after the flag", () => {
    expect(parseFlag(["--config", "eval.yaml"], "--config")).toBe("eval.yaml")
  })

  it("returns null when flag is absent", () => {
    expect(parseFlag(["--other", "value"], "--config")).toBeNull()
  })

  it("returns null when flag is the last token", () => {
    expect(parseFlag(["--config"], "--config")).toBeNull()
  })

  it("returns null when the next token starts with --", () => {
    expect(parseFlag(["--config", "--dry-run"], "--config")).toBeNull()
  })

  it("returns empty array for empty argv", () => {
    expect(parseFlag([], "--config")).toBeNull()
  })
})

describe("parseFlagAll", () => {
  it("returns all values for repeated flags", () => {
    const result = parseFlagAll(["--scenario", "s-001", "--scenario", "s-002"], "--scenario")
    expect(result).toEqual(["s-001", "s-002"])
  })

  it("returns empty array when flag is absent", () => {
    expect(parseFlagAll(["--other", "value"], "--scenario")).toEqual([])
  })

  it("skips occurrences where next token starts with --", () => {
    const result = parseFlagAll(["--scenario", "--dry-run", "--scenario", "s-001"], "--scenario")
    expect(result).toEqual(["s-001"])
  })

  it("returns empty array for empty argv", () => {
    expect(parseFlagAll([], "--scenario")).toEqual([])
  })

  it("does not include the last token if it is the flag itself", () => {
    // argv.length - 1 is the boundary in parseFlagAll loop
    expect(parseFlagAll(["--scenario"], "--scenario")).toEqual([])
  })

  it("returns single-element array for a single occurrence", () => {
    expect(parseFlagAll(["--model", "gpt-4o"], "--model")).toEqual(["gpt-4o"])
  })
})

describe("hasFlag", () => {
  it("returns true when flag is present", () => {
    expect(hasFlag(["--dry-run", "--skip-warmup"], "--dry-run")).toBe(true)
  })

  it("returns false when flag is absent", () => {
    expect(hasFlag(["--config", "eval.yaml"], "--dry-run")).toBe(false)
  })

  it("returns false for empty argv", () => {
    expect(hasFlag([], "--dry-run")).toBe(false)
  })
})
