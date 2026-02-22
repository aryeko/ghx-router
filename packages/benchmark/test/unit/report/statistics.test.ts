import { bootstrapCI, coefficientOfVariation, iqr, percentile } from "@bench/report/statistics.js"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

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

    it("respects confidence parameter", () => {
      const values = Array.from({ length: 100 }, (_, i) => i + 1)
      const ci95 = bootstrapCI(values, 0.95, 1000)
      const ci99 = bootstrapCI(values, 0.99, 1000)
      const ci95Width = ci95[1] - ci95[0]
      const ci99Width = ci99[1] - ci99[0]
      expect(ci99Width).toBeGreaterThanOrEqual(ci95Width)
    })

    it("handles single sample with confidence < 1", () => {
      const [lower, upper] = bootstrapCI([100], 0.9, 100)
      expect(lower).toBe(100)
      expect(upper).toBe(100)
    })
  })
})
