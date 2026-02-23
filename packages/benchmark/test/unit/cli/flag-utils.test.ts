import {
  hasFlag,
  parseFlagValue,
  parseMultiFlagValues,
  parseRequiredFlag,
  parseStrictFlagValue,
} from "@bench/cli/flag-utils.js"
import { describe, expect, it } from "vitest"

describe("parseFlagValue", () => {
  it("parses flag with separate value", () => {
    expect(parseFlagValue(["--flag", "value"], "--flag")).toBe("value")
  })

  it("parses flag with inline value", () => {
    expect(parseFlagValue(["--flag=value"], "--flag")).toBe("value")
  })

  it("returns null for missing flag", () => {
    expect(parseFlagValue(["--other"], "--flag")).toBeNull()
  })

  it("returns null for flag without value", () => {
    expect(parseFlagValue(["--flag"], "--flag")).toBeNull()
  })

  it("returns null when next arg is another flag", () => {
    expect(parseFlagValue(["--flag", "--next"], "--flag")).toBeNull()
  })

  it("returns null for empty inline value", () => {
    expect(parseFlagValue(["--flag="], "--flag")).toBeNull()
  })
})

describe("parseStrictFlagValue", () => {
  it("parses flag with separate value", () => {
    expect(parseStrictFlagValue(["--flag", "value"], "--flag")).toBe("value")
  })

  it("parses flag with inline value", () => {
    expect(parseStrictFlagValue(["--flag=value"], "--flag")).toBe("value")
  })

  it("returns null for missing flag", () => {
    expect(parseStrictFlagValue(["--other"], "--flag")).toBeNull()
  })

  it("throws for flag without value", () => {
    expect(() => parseStrictFlagValue(["--flag"], "--flag")).toThrow("Missing value")
  })

  it("throws when next arg is another flag", () => {
    expect(() => parseStrictFlagValue(["--flag", "--next"], "--flag")).toThrow("Missing value")
  })

  it("throws for empty inline value", () => {
    expect(() => parseStrictFlagValue(["--flag="], "--flag")).toThrow("Missing value")
  })
})

describe("parseRequiredFlag", () => {
  it("parses flag with value", () => {
    expect(parseRequiredFlag(["--flag", "value"], "--flag")).toBe("value")
  })

  it("throws for missing flag", () => {
    expect(() => parseRequiredFlag(["--other"], "--flag")).toThrow("Missing value")
  })
})

describe("parseMultiFlagValues", () => {
  it("collects multiple flag occurrences", () => {
    const args = ["--id", "a", "--id", "b", "--id", "c"]
    expect(parseMultiFlagValues(args, "--id")).toEqual(["a", "b", "c"])
  })

  it("collects inline flag values", () => {
    const args = ["--id=a", "--id=b"]
    expect(parseMultiFlagValues(args, "--id")).toEqual(["a", "b"])
  })

  it("mixes separate and inline values", () => {
    const args = ["--id", "a", "--id=b", "--id", "c"]
    expect(parseMultiFlagValues(args, "--id")).toEqual(["a", "b", "c"])
  })

  it("returns empty array for missing flag", () => {
    expect(parseMultiFlagValues(["--other"], "--flag")).toEqual([])
  })

  it("throws for missing value in separate form", () => {
    expect(() => parseMultiFlagValues(["--id", "--next"], "--id")).toThrow("Missing value")
  })

  it("throws for empty inline value", () => {
    expect(() => parseMultiFlagValues(["--id="], "--id")).toThrow("Missing value")
  })
})

describe("hasFlag", () => {
  it("returns true when flag is present", () => {
    expect(hasFlag(["--flag"], "--flag")).toBe(true)
  })

  it("returns false when flag is missing", () => {
    expect(hasFlag(["--other"], "--flag")).toBe(false)
  })

  it("returns false for inline flag values", () => {
    expect(hasFlag(["--flag=value"], "--flag")).toBe(false)
  })
})
