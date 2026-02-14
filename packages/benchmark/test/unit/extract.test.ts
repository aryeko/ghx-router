import { describe, expect, it } from "vitest"

import { extractFirstJsonObject, validateEnvelope } from "../../src/extract/envelope.js"
import { aggregateToolCounts } from "../../src/extract/tool-usage.js"

describe("extractors", () => {
  it("extracts JSON object from plain text", () => {
    const payload = extractFirstJsonObject(
      "prefix {\"ok\":true,\"data\":{},\"error\":null,\"meta\":{}} suffix"
    )

    expect(payload).toBeTruthy()
  })

  it("extracts first balanced JSON object when extra braces exist later", () => {
    const payload = extractFirstJsonObject(
      "prefix {\"ok\":true,\"data\":{\"message\":\"brace } in text\"},\"error\":null,\"meta\":{}} trailing {not-json}"
    ) as { ok?: boolean } | null

    expect(payload?.ok).toBe(true)
  })

  it("returns null for malformed or missing JSON object", () => {
    expect(extractFirstJsonObject("no braces here")).toBeNull()
    expect(extractFirstJsonObject("prefix {not-json}")).toBeNull()
  })

  it("handles escaped characters inside JSON strings", () => {
    const payload = extractFirstJsonObject(
      String.raw`prefix {"ok":true,"data":{"text":"quote: \" and slash: \\"},"error":null,"meta":{}} suffix`
    ) as { data?: { text?: string } } | null

    expect(payload?.data?.text).toBe('quote: " and slash: \\')
  })

  it("returns null when JSON object is never closed", () => {
    expect(extractFirstJsonObject('prefix {"ok":true')).toBeNull()
  })

  it("validates envelope with required fields", () => {
    const valid = validateEnvelope(
      {
        must_succeed: true,
        required_fields: ["ok", "data", "error", "meta"]
      },
      {
        ok: true,
        data: {},
        error: null,
        meta: {}
      }
    )

    expect(valid).toBe(true)
  })

  it("rejects invalid envelope shapes and data constraints", () => {
    expect(validateEnvelope({ must_succeed: true }, null)).toBe(false)
    expect(validateEnvelope({ must_succeed: true }, { ok: "true" })).toBe(false)
    expect(
      validateEnvelope(
        { must_succeed: true, required_fields: ["meta"] },
        { ok: true, data: {}, error: null }
      )
    ).toBe(false)
    expect(validateEnvelope({ must_succeed: true, data_type: "array" }, { ok: true, data: {} })).toBe(false)
    expect(validateEnvelope({ must_succeed: true, data_type: "object" }, { ok: true, data: [] })).toBe(false)
    expect(
      validateEnvelope(
        { must_succeed: true, required_data_fields: ["id"] },
        { ok: true, data: [] }
      )
    ).toBe(false)
  })

  it("validates expected route usage assertions", () => {
    expect(
      validateEnvelope(
        {
          must_succeed: true,
          expected_route_used: "cli",
          required_meta_fields: ["route_used"]
        },
        {
          ok: true,
          data: {},
          error: null,
          meta: {
            route_used: "cli"
          }
        }
      )
    ).toBe(true)

    expect(
      validateEnvelope(
        {
          must_succeed: true,
          expected_route_used: "graphql"
        },
        {
          ok: true,
          data: {},
          error: null,
          meta: {
            route_used: "graphql"
          }
        }
      )
    ).toBe(true)

    expect(
      validateEnvelope(
        {
          must_succeed: true,
          expected_route_used: "graphql"
        },
        {
          ok: true,
          data: {},
          error: null,
          meta: {
            route_used: "cli"
          }
        }
      )
    ).toBe(false)

    expect(
      validateEnvelope(
        {
          must_succeed: true,
          required_meta_fields: ["route_used"]
        },
        {
          ok: true,
          data: {},
          error: null,
          meta: null
        }
      )
    ).toBe(false)

    expect(
      validateEnvelope(
        {
          must_succeed: true,
          required_meta_fields: ["route_used"]
        },
        {
          ok: true,
          data: {},
          error: null,
          meta: {}
        }
      )
    ).toBe(false)
  })

  it("validates expected error code assertions", () => {
    expect(
      validateEnvelope(
        {
          must_succeed: false,
          expected_error_code: "SERVER"
        },
        {
          ok: false,
          data: null,
          error: {
            code: "SERVER",
            message: "Output schema validation failed",
            retryable: false
          },
          meta: { route_used: "graphql" }
        }
      )
    ).toBe(true)

    expect(
      validateEnvelope(
        {
          must_succeed: false,
          expected_error_code: "VALIDATION"
        },
        {
          ok: false,
          data: null,
          error: {
            code: "VALIDATION",
            message: "Input schema validation failed",
            retryable: false
          },
          meta: { route_used: "cli" }
        }
      )
    ).toBe(true)

    expect(
      validateEnvelope(
        {
          must_succeed: false,
          expected_error_code: "SERVER"
        },
        {
          ok: false,
          data: null,
          error: {
            code: "VALIDATION",
            message: "Input schema validation failed",
            retryable: false
          },
          meta: { route_used: "graphql" }
        }
      )
    ).toBe(false)

    expect(
      validateEnvelope(
        {
          must_succeed: false,
          expected_error_code: "SERVER"
        },
        {
          ok: false,
          data: null,
          error: null,
          meta: { route_used: "graphql" }
        }
      )
    ).toBe(false)
  })

  it("counts tool calls across message parts", () => {
    const counts = aggregateToolCounts([
      {
        parts: [
          { type: "tool", tool: "bash" },
          { type: "tool", tool: "api-client" },
          { type: "text", text: "done" }
        ]
      }
    ])

    expect(counts.toolCalls).toBe(2)
    expect(counts.apiCalls).toBe(1)
  })

  it("handles messages without parts", () => {
    const counts = aggregateToolCounts([{}])

    expect(counts).toEqual({ toolCalls: 0, apiCalls: 0 })
  })

  it("counts http tool names and ignores non-api tools", () => {
    const counts = aggregateToolCounts([
      {
        parts: [
          { type: "tool", tool: "HTTP-FETCH" },
          { type: "tool", tool: "filesystem" },
          { type: "tool" },
          { type: "text", text: "hello" }
        ]
      }
    ])

    expect(counts.toolCalls).toBe(3)
    expect(counts.apiCalls).toBe(1)
  })
})
