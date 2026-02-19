import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  bootstrapCI,
  coefficientOfVariation,
  iqr,
  percentile,
} from "../../src/report/statistics.js"

// Deterministic PRNG (mulberry32) to make bootstrapCI tests repeatable
function mulberry32(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let originalRandom: typeof Math.random

describe("statistics", () => {
  describe("percentile", () => {
    it("returns 0 for empty array", () => {
      expect(percentile([], 50)).toBe(0)
    })

    it("returns single value for single-element array", () => {
      expect(percentile([42], 50)).toBe(42)
    })

    it("computes p50 (median) for odd-length array", () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3)
    })

    it("computes p50 (median) for even-length array", () => {
      expect(percentile([1, 2, 3, 4], 50)).toBe(2.5)
    })

    it("computes p25 (lower quartile)", () => {
      expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 25)).toBe(3.25)
    })

    it("computes p75 (upper quartile)", () => {
      expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 75)).toBe(7.75)
    })

    it("computes p0 (min)", () => {
      expect(percentile([5, 10, 15, 20, 25], 0)).toBe(5)
    })

    it("computes p100 (max)", () => {
      expect(percentile([5, 10, 15, 20, 25], 100)).toBe(25)
    })

    it("handles unsorted input", () => {
      expect(percentile([5, 1, 3, 2, 4], 50)).toBe(3)
    })

    it("throws error for invalid percentile < 0", () => {
      expect(() => percentile([1, 2, 3], -1)).toThrow()
    })

    it("throws error for invalid percentile > 100", () => {
      expect(() => percentile([1, 2, 3], 101)).toThrow()
    })
  })

  describe("iqr", () => {
    it("returns 0 for empty array", () => {
      expect(iqr([])).toBe(0)
    })

    it("computes IQR correctly", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const result = iqr(values)
      expect(result).toBeCloseTo(4.5, 1)
    })

    it("returns 0 for single-element array", () => {
      expect(iqr([42])).toBe(0)
    })

    it("computes IQR for identical values", () => {
      expect(iqr([5, 5, 5, 5, 5])).toBe(0)
    })
  })

  describe("coefficientOfVariation", () => {
    it("returns 0 for empty array", () => {
      expect(coefficientOfVariation([])).toBe(0)
    })

    it("returns 0 for identical values", () => {
      expect(coefficientOfVariation([10, 10, 10, 10])).toBe(0)
    })

    it("returns 0 for all-zero values", () => {
      expect(coefficientOfVariation([0, 0, 0])).toBe(0)
    })

    it("computes CV correctly", () => {
      const values = [10, 20, 30, 40, 50]
      const result = coefficientOfVariation(values)
      expect(result).toBeCloseTo(47.14, 1)
    })

    it("computes CV for single value", () => {
      expect(coefficientOfVariation([42])).toBe(0)
    })

    it("computes CV for low variation", () => {
      const values = [100, 101, 102, 99, 98]
      const result = coefficientOfVariation(values)
      expect(result).toBeLessThan(5)
    })
  })

  describe("bootstrapCI", () => {
    beforeEach(() => {
      originalRandom = Math.random
      Math.random = mulberry32(42)
    })

    afterEach(() => {
      Math.random = originalRandom
    })

    it("returns [0, 0] for empty array", () => {
      const [lower, upper] = bootstrapCI([])
      expect(lower).toBe(0)
      expect(upper).toBe(0)
    })

    it("returns single value bounds for single-element array", () => {
      const [lower, upper] = bootstrapCI([42])
      expect(lower).toBe(42)
      expect(upper).toBe(42)
    })

    it("computes reasonable CI for normal values", () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1)
      const [lower, upper] = bootstrapCI(values, 0.95, 1000)
      expect(lower).toBeGreaterThanOrEqual(25)
      expect(upper).toBeLessThanOrEqual(75)
      expect(lower).toBeLessThan(upper)
    })

    it("respects confidence parameter (wider for higher confidence)", () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1)
      const ci95 = bootstrapCI(values, 0.95, 1000)
      const ci99 = bootstrapCI(values, 0.99, 1000)
      const ci95Width = ci95[1] - ci95[0]
      const ci99Width = ci99[1] - ci99[0]
      expect(ci99Width).toBeGreaterThan(ci95Width)
    })

    it("produces valid CI with varying iterations", () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1)
      const ci1k = bootstrapCI(values, 0.95, 1000)
      const ci10k = bootstrapCI(values, 0.95, 10000)
      expect(ci1k[1] - ci1k[0]).toBeGreaterThan(0)
      expect(ci10k[1] - ci10k[0]).toBeGreaterThan(0)
      expect(ci10k[0]).toBeLessThan(ci10k[1])
    })

    it("maintains correct order: lower <= upper", () => {
      const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
      const [lower, upper] = bootstrapCI(values, 0.95, 5000)
      expect(lower).toBeLessThanOrEqual(upper)
    })

    it("uses default confidence of 95%", () => {
      const values = Array.from({ length: 50 }, (_, i) => i + 1)
      const ciDefault = bootstrapCI(values)
      const ciExplicit = bootstrapCI(values, 0.95)
      expect(ciDefault[0]).toBeDefined()
      expect(ciDefault[1]).toBeDefined()
      expect(ciExplicit[0]).toBeDefined()
      expect(ciExplicit[1]).toBeDefined()
    })

    it("uses default iterations of 10000", () => {
      const values = Array.from({ length: 50 }, (_, i) => i + 1)
      const ciDefault = bootstrapCI(values, 0.95)
      expect(ciDefault[0]).toBeDefined()
      expect(ciDefault[1]).toBeDefined()
    })

    it("returns bounds for two-element array", () => {
      const [lower, upper] = bootstrapCI([10, 20], 0.95, 1000)
      expect(lower).toBeDefined()
      expect(upper).toBeDefined()
      expect(lower).toBeLessThanOrEqual(upper)
    })

    it("handles edge case with very small array", () => {
      const [lower, upper] = bootstrapCI([5, 10, 15], 0.95, 100)
      expect(lower).toBeDefined()
      expect(upper).toBeDefined()
      expect(lower).toBeGreaterThanOrEqual(0)
      expect(upper).toBeGreaterThanOrEqual(0)
    })

    it("handles high confidence levels", () => {
      const values = Array.from({ length: 50 }, (_, i) => i + 1)
      const ci99_9 = bootstrapCI(values, 0.999, 1000)
      expect(ci99_9[0]).toBeLessThanOrEqual(ci99_9[1])
    })

    it("handles low confidence levels", () => {
      const values = Array.from({ length: 50 }, (_, i) => i + 1)
      const ci50 = bootstrapCI(values, 0.5, 1000)
      expect(ci50[0]).toBeLessThanOrEqual(ci50[1])
      const ci95 = bootstrapCI(values, 0.95, 1000)
      expect(ci50[1] - ci50[0]).toBeLessThan(ci95[1] - ci95[0])
    })
  })

  describe("percentile edge cases", () => {
    it("computes percentile with fractional index at boundary", () => {
      const values = [10, 20, 30, 40, 50]
      const p = percentile(values, 60)
      expect(p).toBeGreaterThan(30)
      expect(p).toBeLessThan(40)
    })

    it("handles single element with various percentiles", () => {
      const values = [42]
      expect(percentile(values, 0)).toBe(42)
      expect(percentile(values, 50)).toBe(42)
      expect(percentile(values, 100)).toBe(42)
    })

    it("computes percentile at exact boundaries", () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1)
      expect(percentile(values, 0)).toBe(1)
      expect(percentile(values, 100)).toBe(100)
    })

    it("handles two-element array percentiles", () => {
      const result25 = percentile([10, 20], 25)
      const result75 = percentile([10, 20], 75)
      expect(result25).toBeGreaterThan(10)
      expect(result25).toBeLessThan(20)
      expect(result75).toBeGreaterThan(10)
      expect(result75).toBeLessThan(20)
      expect(result25).toBeLessThan(result75)
    })
  })
})
