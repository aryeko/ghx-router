import { extractArrayItemHints } from "@core/core/registry/schema-utils.js"
import { describe, expect, it } from "vitest"

describe("extractArrayItemHints", () => {
  it("returns item fields for an array-type property", () => {
    const schema = {
      type: "object",
      required: ["tags"],
      properties: {
        tags: {
          type: "array",
          items: {
            type: "object",
            required: ["name"],
            properties: {
              name: { type: "string" },
              color: { type: "string" },
            },
          },
        },
      },
    }

    const hints = extractArrayItemHints(schema)

    expect(hints).toHaveProperty("tags")
    expect(hints.tags).toContain("name")
    expect(hints.tags).toContain("color?")
  })

  it("lists required fields before optional fields", () => {
    const schema = {
      type: "object",
      properties: {
        comments: {
          type: "array",
          items: {
            type: "object",
            required: ["path", "body", "line"],
            properties: {
              path: { type: "string" },
              body: { type: "string" },
              line: { type: "integer" },
              side: { type: "string" },
              startLine: { type: "integer" },
            },
          },
        },
      },
    }

    const hints = extractArrayItemHints(schema)

    expect(hints.comments).toEqual(["path", "body", "line", "side?", "startLine?"])
  })

  it("returns empty object for non-array properties", () => {
    const schema = {
      type: "object",
      properties: {
        owner: { type: "string" },
        count: { type: "integer" },
      },
    }

    const hints = extractArrayItemHints(schema)

    expect(hints).toEqual({})
  })

  it("returns empty object for null or undefined schema", () => {
    expect(extractArrayItemHints(null)).toEqual({})
    expect(extractArrayItemHints(undefined)).toEqual({})
  })

  it("ignores array properties with no item properties", () => {
    const schema = {
      type: "object",
      properties: {
        tags: {
          type: "array",
          items: { type: "string" },
        },
      },
    }

    const hints = extractArrayItemHints(schema)

    expect(hints).toEqual({})
  })
})
