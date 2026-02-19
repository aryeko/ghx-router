import {
  parseFlagValue,
  parseMultiFlagValues,
  parseRequiredFlag,
  parseStrictFlagValue,
} from "@bench/cli/flag-utils.js"
import { describe, expect, it } from "vitest"

describe("parseFlagValue", () => {
  it("returns value for split form: --flag value", () => {
    expect(parseFlagValue(["--model", "gpt-5"], "--model")).toBe("gpt-5")
  })

  it("returns value for inline form: --flag=value", () => {
    expect(parseFlagValue(["--model=gpt-5"], "--model")).toBe("gpt-5")
  })

  it("returns null when flag is absent", () => {
    expect(parseFlagValue(["--other", "val"], "--model")).toBeNull()
  })

  it("returns null when next arg is missing", () => {
    expect(parseFlagValue(["--model"], "--model")).toBeNull()
  })

  it("returns null when next arg is another flag", () => {
    expect(parseFlagValue(["--model", "--other"], "--model")).toBeNull()
  })

  it("trims whitespace from values", () => {
    expect(parseFlagValue(["--model", "  gpt-5  "], "--model")).toBe("gpt-5")
  })
})

describe("parseStrictFlagValue", () => {
  it("returns value when present", () => {
    expect(parseStrictFlagValue(["--model", "gpt-5"], "--model")).toBe("gpt-5")
  })

  it("returns value for inline form", () => {
    expect(parseStrictFlagValue(["--model=gpt-5"], "--model")).toBe("gpt-5")
  })

  it("returns null when flag is absent", () => {
    expect(parseStrictFlagValue(["--other", "val"], "--model")).toBeNull()
  })

  it("throws when flag is present but next arg is missing", () => {
    expect(() => parseStrictFlagValue(["--model"], "--model")).toThrow("Missing value for --model")
  })

  it("throws when flag is present but next arg is another flag", () => {
    expect(() => parseStrictFlagValue(["--model", "--other"], "--model")).toThrow(
      "Missing value for --model",
    )
  })

  it("throws for empty inline value", () => {
    expect(() => parseStrictFlagValue(["--model="], "--model")).toThrow("Missing value for --model")
  })
})

describe("parseRequiredFlag", () => {
  it("returns value when present", () => {
    expect(parseRequiredFlag(["--set", "pr-exec"], "--set")).toBe("pr-exec")
  })

  it("throws when flag is absent", () => {
    expect(() => parseRequiredFlag([], "--set")).toThrow("Missing value for --set")
  })

  it("throws when next arg is another flag", () => {
    expect(() => parseRequiredFlag(["--set", "--other"], "--set")).toThrow(
      "Missing value for --set",
    )
  })

  it("throws for empty inline value", () => {
    expect(() => parseRequiredFlag(["--set="], "--set")).toThrow("Missing value for --set")
  })
})

describe("parseMultiFlagValues", () => {
  it("collects repeated flags", () => {
    expect(
      parseMultiFlagValues(["--scenario-id", "a", "--scenario-id", "b"], "--scenario-id"),
    ).toEqual(["a", "b"])
  })

  it("supports inline form", () => {
    expect(parseMultiFlagValues(["--scenario-id=a"], "--scenario-id")).toEqual(["a"])
  })

  it("returns empty array when flag is absent", () => {
    expect(parseMultiFlagValues(["--other", "val"], "--scenario-id")).toEqual([])
  })

  it("throws on missing value after flag", () => {
    expect(() => parseMultiFlagValues(["--scenario-id", "--other"], "--scenario-id")).toThrow(
      "Missing value for --scenario-id",
    )
  })
})
