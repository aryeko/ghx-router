import { buildCacheKey, createResolutionCache } from "@core/core/routing/resolution-cache.js"
import { afterEach, describe, expect, it, vi } from "vitest"

describe("createResolutionCache", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("get returns undefined for missing key", () => {
    const cache = createResolutionCache()
    expect(cache.get("nonexistent")).toBeUndefined()
  })

  it("set + get round-trip returns cached value", () => {
    const cache = createResolutionCache()
    const value = { repository: { labels: { nodes: [{ id: "L1", name: "bug" }] } } }
    cache.set("key1", value)
    expect(cache.get("key1")).toEqual(value)
  })

  it("expired entries return undefined after TTL", () => {
    const cache = createResolutionCache({ ttlMs: 100 })
    cache.set("key1", "value1")

    // Advance time past TTL
    const now = Date.now()
    vi.spyOn(Date, "now").mockReturnValue(now + 200)

    expect(cache.get("key1")).toBeUndefined()
    // Entry should be cleaned up
    expect(cache.size).toBe(0)
  })

  it("maxEntries evicts oldest entry when exceeded", () => {
    const cache = createResolutionCache({ maxEntries: 2 })
    cache.set("first", 1)
    cache.set("second", 2)
    cache.set("third", 3)

    expect(cache.get("first")).toBeUndefined()
    expect(cache.get("second")).toBe(2)
    expect(cache.get("third")).toBe(3)
    expect(cache.size).toBe(2)
  })

  it("clear() empties the cache", () => {
    const cache = createResolutionCache()
    cache.set("a", 1)
    cache.set("b", 2)
    expect(cache.size).toBe(2)

    cache.clear()
    expect(cache.size).toBe(0)
    expect(cache.get("a")).toBeUndefined()
  })

  it("updating an existing key does not evict", () => {
    const cache = createResolutionCache({ maxEntries: 2 })
    cache.set("a", 1)
    cache.set("b", 2)
    // Update "a" — should not evict because key already exists
    cache.set("a", 10)
    expect(cache.size).toBe(2)
    expect(cache.get("a")).toBe(10)
    expect(cache.get("b")).toBe(2)
  })
})

describe("buildCacheKey", () => {
  it("produces stable keys regardless of property order", () => {
    const key1 = buildCacheKey("IssueLabelsLookup", { issueId: "I1", owner: "acme" })
    const key2 = buildCacheKey("IssueLabelsLookup", { owner: "acme", issueId: "I1" })
    expect(key1).toBe(key2)
  })

  it("differentiates by operation name", () => {
    const key1 = buildCacheKey("OpA", { x: 1 })
    const key2 = buildCacheKey("OpB", { x: 1 })
    expect(key1).not.toBe(key2)
  })

  it("differentiates by variable values", () => {
    const key1 = buildCacheKey("Op", { id: "A" })
    const key2 = buildCacheKey("Op", { id: "B" })
    expect(key1).not.toBe(key2)
  })
})
