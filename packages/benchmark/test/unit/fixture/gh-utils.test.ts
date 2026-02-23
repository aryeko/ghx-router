import { parseArrayResponse, parseRepo } from "@bench/fixture/gh-utils.js"
import { describe, expect, it } from "vitest"

describe("parseRepo", () => {
  it("splits a valid owner/name string", () => {
    expect(parseRepo("acme/my-repo")).toEqual({ owner: "acme", name: "my-repo" })
  })

  it("throws when there is no slash", () => {
    expect(() => parseRepo("noslash")).toThrow("invalid repo format")
  })

  it("throws when owner is empty", () => {
    expect(() => parseRepo("/name")).toThrow("invalid repo format")
  })

  it("throws when name is empty", () => {
    expect(() => parseRepo("owner/")).toThrow("invalid repo format")
  })

  it("throws when there are too many slashes", () => {
    expect(() => parseRepo("a/b/c")).toThrow("invalid repo format")
  })
})

describe("parseArrayResponse", () => {
  it("returns the value directly when it is already an array", () => {
    expect(parseArrayResponse([1, 2, 3])).toEqual([1, 2, 3])
  })

  it("extracts .items when present", () => {
    expect(parseArrayResponse({ items: ["a", "b"] })).toEqual(["a", "b"])
  })

  it("extracts .projects when present", () => {
    expect(parseArrayResponse({ projects: ["p1"] })).toEqual(["p1"])
  })

  it("extracts .nodes when present", () => {
    expect(parseArrayResponse({ nodes: [{ id: 1 }] })).toEqual([{ id: 1 }])
  })

  it("extracts .fields when present", () => {
    expect(parseArrayResponse({ fields: ["f1", "f2"] })).toEqual(["f1", "f2"])
  })

  it("returns empty array for plain object with no recognised keys", () => {
    expect(parseArrayResponse({ unknown: "value" })).toEqual([])
  })

  it("returns empty array for null", () => {
    expect(parseArrayResponse(null)).toEqual([])
  })

  it("returns empty array for a primitive", () => {
    expect(parseArrayResponse(42)).toEqual([])
    expect(parseArrayResponse("string")).toEqual([])
  })
})
