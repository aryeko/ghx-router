import { describe, expect, it } from "vitest"

import { getOperationCard, listOperationCards, validateOperationCard } from "../../src/core/registry/index.js"

describe("operation cards registry", () => {
  it("lists all v1 thin-slice capabilities", () => {
    const capabilities = listOperationCards().map((card) => card.capability_id)

    expect(capabilities).toEqual([
      "repo.view",
      "issue.view",
      "issue.list",
      "issue.comments.list",
      "pr.view",
      "pr.list"
    ])
  })

  it("resolves cards by capability id", () => {
    const card = getOperationCard("issue.view")

    expect(card).toBeDefined()
    expect(card?.routing.preferred).toBe("cli")
    expect(card?.routing.fallbacks).toEqual(["graphql"])
  })

  it("requires explicit pagination input for issue.comments.list", () => {
    const card = getOperationCard("issue.comments.list")
    expect(card?.input_schema.required).toEqual(["owner", "name", "issueNumber", "first"])
  })

  it("requires explicit pagination input for list capabilities", () => {
    const issueListCard = getOperationCard("issue.list")
    const prListCard = getOperationCard("pr.list")

    expect(issueListCard?.input_schema.required).toEqual(["owner", "name"])
    expect(prListCard?.input_schema.required).toEqual(["owner", "name"])
  })

  it("exposes CLI command metadata for card-driven adapter execution", () => {
    const card = getOperationCard("issue.comments.list")
    expect(card?.cli).toEqual(
      expect.objectContaining({
        command: "api graphql"
      })
    )
  })

  it("allows nullable defaultBranch in repo.view output schema", () => {
    const card = getOperationCard("repo.view")
    const properties = card?.output_schema.properties as Record<string, unknown>
    const defaultBranch = properties.defaultBranch as Record<string, unknown>

    expect(defaultBranch.type).toEqual(["string", "null"])
  })

  it("documents cursor-capable CLI pagination for issue comments fallback", () => {
    const card = getOperationCard("issue.comments.list")
    expect(card?.routing.notes).toEqual(
      expect.arrayContaining([
        expect.stringContaining("gh api graphql"),
        expect.stringContaining("cursor pagination")
      ])
    )
  })

  it("keeps rest route disabled until implemented", () => {
    const cards = listOperationCards()

    for (const card of cards) {
      expect(card.routing.preferred).not.toBe("rest")
      expect(card.routing.fallbacks).not.toContain("rest")
    }
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
