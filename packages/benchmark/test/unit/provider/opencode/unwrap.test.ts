import { unwrapData } from "@bench/provider/opencode/unwrap.js"
import { describe, expect, it } from "vitest"

describe("unwrapData", () => {
  it("unwraps data from wrapped response", () => {
    const result = unwrapData<{ id: string }>({ data: { id: "abc" } }, "test")
    expect(result).toEqual({ id: "abc" })
  })

  it("returns value as-is when not wrapped", () => {
    const value = { id: "abc" }
    const result = unwrapData<{ id: string }>(value, "test")
    expect(result).toBe(value)
  })

  it("returns primitive values as-is", () => {
    expect(unwrapData<string>("hello", "test")).toBe("hello")
    expect(unwrapData<number>(42, "test")).toBe(42)
    expect(unwrapData<null>(null, "test")).toBeNull()
  })

  it("throws when wrapped response has error payload", () => {
    expect(() =>
      unwrapData({ data: { id: "abc" }, error: { message: "something failed" } }, "test.op"),
    ).toThrow("test.op returned error payload")
  })

  it("returns arrays as-is (no unwrapping)", () => {
    const arr = [1, 2, 3]
    expect(unwrapData<number[]>(arr, "test")).toBe(arr)
  })

  it("unwraps nested data correctly", () => {
    const nested = { data: [{ id: "1" }, { id: "2" }] }
    const result = unwrapData<Array<{ id: string }>>(nested, "test")
    expect(result).toEqual([{ id: "1" }, { id: "2" }])
  })
})
