import { evaluateCondition } from "@bench/runner/checkpoint.js"
import { describe, expect, it } from "vitest"

describe("evaluateCondition", () => {
  describe("empty", () => {
    it("returns true for empty array", () => {
      expect(evaluateCondition("empty", [])).toBe(true)
    })

    it("returns true for null", () => {
      expect(evaluateCondition("empty", null)).toBe(true)
    })

    it("returns true for undefined", () => {
      expect(evaluateCondition("empty", undefined)).toBe(true)
    })

    it("returns false for non-empty array", () => {
      expect(evaluateCondition("empty", [1, 2, 3])).toBe(false)
    })

    it("returns false for object", () => {
      expect(evaluateCondition("empty", { a: 1 })).toBe(false)
    })
  })

  describe("non_empty", () => {
    it("returns true for non-empty array", () => {
      expect(evaluateCondition("non_empty", [1, 2, 3])).toBe(true)
    })

    it("returns true for object", () => {
      expect(evaluateCondition("non_empty", { a: 1 })).toBe(true)
    })

    it("returns false for empty array", () => {
      expect(evaluateCondition("non_empty", [])).toBe(false)
    })

    it("returns false for null", () => {
      expect(evaluateCondition("non_empty", null)).toBe(false)
    })

    it("returns false for undefined", () => {
      expect(evaluateCondition("non_empty", undefined)).toBe(false)
    })
  })

  describe("count_gte", () => {
    it("returns true when array length >= expected", () => {
      expect(evaluateCondition("count_gte", [1, 2, 3], 3)).toBe(true)
      expect(evaluateCondition("count_gte", [1, 2, 3], 2)).toBe(true)
    })

    it("returns false when array length < expected", () => {
      expect(evaluateCondition("count_gte", [1, 2], 3)).toBe(false)
    })

    it("returns false for non-array", () => {
      expect(evaluateCondition("count_gte", { a: 1 }, 1)).toBe(false)
    })
  })

  describe("count_eq", () => {
    it("returns true when array length equals expected", () => {
      expect(evaluateCondition("count_eq", [1, 2, 3], 3)).toBe(true)
    })

    it("returns false when array length differs", () => {
      expect(evaluateCondition("count_eq", [1, 2, 3], 2)).toBe(false)
    })

    it("returns false for non-array", () => {
      expect(evaluateCondition("count_eq", { a: 1 }, 1)).toBe(false)
    })
  })

  describe("field_equals", () => {
    it("returns true when all expected fields match", () => {
      const data = { id: "123", status: "open" }
      const expected = { id: "123", status: "open" }
      expect(evaluateCondition("field_equals", data, expected)).toBe(true)
    })

    it("returns true for subset match", () => {
      const data = { id: "123", status: "open", other: "value" }
      const expected = { id: "123", status: "open" }
      expect(evaluateCondition("field_equals", data, expected)).toBe(true)
    })

    it("returns false when any expected field differs", () => {
      const data = { id: "123", status: "open" }
      const expected = { id: "123", status: "closed" }
      expect(evaluateCondition("field_equals", data, expected)).toBe(false)
    })

    it("returns false for non-objects", () => {
      expect(evaluateCondition("field_equals", [1, 2, 3], { a: 1 })).toBe(false)
      expect(evaluateCondition("field_equals", { a: 1 }, [1, 2, 3])).toBe(false)
    })

    it("handles nested values correctly", () => {
      const data = { nested: { key: "value" } }
      const expected = { nested: { key: "value" } }
      expect(evaluateCondition("field_equals", data, expected)).toBe(true)

      const differentNested = { nested: { key: "different" } }
      expect(evaluateCondition("field_equals", data, differentNested)).toBe(false)
    })
  })
})
