import { validateOperationCard } from "@core/core/registry/index.js"
import { describe, expect, it } from "vitest"

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
        routing: { preferred: "invalid", fallbacks: [] },
      }).ok,
    ).toBe(false)
    expect(
      validateOperationCard({
        capability_id: "x",
        version: "1",
        description: "d",
        input_schema: {},
        output_schema: {},
        routing: { preferred: "cli", fallbacks: "bad" },
      }).ok,
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
        fallbacks: ["cli"],
      },
    })

    expect(result.ok).toBe(true)
  })
})

describe("card resolution blocks", () => {
  it("issue.labels.set has resolution config", async () => {
    const { getOperationCard } = await import("@core/core/registry/index.js")
    const card = getOperationCard("issue.labels.set")
    expect(card).toBeDefined()
    if (!card) return
    expect(card.graphql?.resolution).toBeDefined()
    expect(card.graphql?.resolution?.lookup.operationName).toBe("IssueLabelsLookupByNumber")
    expect(card.graphql?.resolution?.inject[1]?.source).toBe("map_array")
  })

  it("issue.milestone.set has scalar resolution", async () => {
    const { getOperationCard } = await import("@core/core/registry/index.js")
    const card = getOperationCard("issue.milestone.set")
    expect(card).toBeDefined()
    if (!card) return
    expect(card.graphql?.resolution).toBeDefined()
    expect(card.graphql?.resolution?.inject[0]?.source).toBe("scalar")
  })
})
