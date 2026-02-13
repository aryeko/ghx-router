import { describe, expect, it } from "vitest"

import { validateOperationCard } from "../../src/core/registry/index.js"

describe("validateOperationCard", () => {
  it("rejects malformed operation cards", () => {
    expect(validateOperationCard(null).ok).toBe(false)
    expect(
      validateOperationCard({
        capability_id: "x",
        version: "1",
        description: "d",
        input_schema: {},
        output_schema: {},
        routing: { preferred: "invalid", fallbacks: [] }
      }).ok
    ).toBe(false)
    expect(
      validateOperationCard({
        capability_id: "x",
        version: "1",
        description: "d",
        input_schema: {},
        output_schema: {},
        routing: { preferred: "cli", fallbacks: "bad" }
      }).ok
    ).toBe(false)
  })

  it("accepts a valid operation card", () => {
    const result = validateOperationCard({
      capability_id: "repo.view",
      version: "1.0.0",
      description: "Repo",
      input_schema: {},
      output_schema: {},
      routing: {
        preferred: "graphql",
        fallbacks: ["cli"]
      }
    })

    expect(result.ok).toBe(true)
  })
})
