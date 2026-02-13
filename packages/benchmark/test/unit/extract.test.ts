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
})
