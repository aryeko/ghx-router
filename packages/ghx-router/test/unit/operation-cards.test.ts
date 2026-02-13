import { describe, expect, it } from "vitest"

import { getOperationCard, listOperationCards, validateOperationCard } from "../../src/core/registry/index.js"

describe("operation cards registry", () => {
  it("lists all v1 thin-slice capabilities", () => {
    const capabilities = listOperationCards().map((card) => card.capability_id)

    expect(capabilities).toEqual([
      "repo.view",
      "issue.view",
      "issue.list",
      "pr.view",
      "pr.list"
    ])
  })

  it("resolves cards by capability id", () => {
    const card = getOperationCard("issue.view")

    expect(card).toBeDefined()
    expect(card?.routing.preferred).toBe("graphql")
    expect(card?.routing.fallbacks).toEqual(["cli", "rest"])
  })

  it("validates required card fields", () => {
    const card = getOperationCard("pr.list")
    if (!card) {
      throw new Error("expected card to exist")
    }

    expect(validateOperationCard(card)).toEqual({ ok: true })
  })

  it("fails validation for malformed cards", () => {
    const result = validateOperationCard({
      capability_id: "broken.card"
    })

    expect(result.ok).toBe(false)
  })
})
