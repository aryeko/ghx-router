import { isObject } from "@bench/util/guards.js"
import { describe, expect, it } from "vitest"

describe("isObject", () => {
  it("returns true for plain objects", () => {
    expect(isObject({})).toBe(true)
    expect(isObject({ a: 1 })).toBe(true)
  })

  it("returns false for null", () => {
    expect(isObject(null)).toBe(false)
  })

  it("returns false for arrays", () => {
    expect(isObject([])).toBe(false)
    expect(isObject([1, 2, 3])).toBe(false)
  })

  it("returns false for primitives", () => {
    expect(isObject(42)).toBe(false)
    expect(isObject("string")).toBe(false)
    expect(isObject(true)).toBe(false)
    expect(isObject(undefined)).toBe(false)
  })

  it("returns true for class instances", () => {
    expect(isObject(new Date())).toBe(true)
    expect(isObject(new Map())).toBe(true)
  })
})
