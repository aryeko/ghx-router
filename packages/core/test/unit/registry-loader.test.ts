import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.resetModules()
  vi.doUnmock("node:fs")
  vi.doUnmock("js-yaml")
})

describe("registry yaml loader", () => {
  it("sorts unknown cards using filename locale order", async () => {
    vi.doMock("node:fs", () => ({
      readdirSync: () => ["zzz.yaml", "aaa.yaml"],
      readFileSync: (path: string) => (path.includes("aaa") ? "AAA" : "ZZZ"),
    }))

    vi.doMock("js-yaml", () => ({
      load: (raw: string) => {
        if (raw === "AAA") {
          return {
            capability_id: "aaa.capability",
            version: "1.0.0",
            description: "AAA",
            input_schema: {},
            output_schema: {},
            routing: { preferred: "cli", fallbacks: [] },
            cli: { command: "repo view" },
          }
        }

        return {
          capability_id: "zzz.capability",
          version: "1.0.0",
          description: "ZZZ",
          input_schema: {},
          output_schema: {},
          routing: { preferred: "cli", fallbacks: [] },
          cli: { command: "repo view" },
        }
      },
    }))

    const registry = await import("@core/core/registry/index.js")
    expect(registry.listOperationCards().map((card) => card.capability_id)).toEqual([
      "aaa.capability",
      "zzz.capability",
    ])
  })

  it("throws when a YAML card fails schema validation", async () => {
    vi.doMock("node:fs", () => ({
      readdirSync: () => ["broken.yaml"],
      readFileSync: () => "BROKEN",
    }))

    vi.doMock("js-yaml", () => ({
      load: () => ({
        capability_id: "broken.capability",
        version: "1.0.0",
        description: "Broken",
        input_schema: {},
        output_schema: {},
        routing: { preferred: "cli", fallbacks: [] },
        cli: {},
      }),
    }))

    await expect(import("@core/core/registry/index.js")).rejects.toThrow("Invalid operation card")
  })
})
