import { describe, expect, it } from "vitest"

import { getOperationCard, listOperationCards, validateOperationCard } from "../../src/core/registry/index.js"

describe("operation cards registry", () => {
  it("lists all v1 thin-slice capabilities", () => {
    const capabilities = listOperationCards().map((card) => card.capability_id)

    expect(capabilities).toEqual([
      "repo.view",
      "repo.labels.list",
      "repo.issue_types.list",
      "issue.view",
      "issue.list",
      "issue.comments.list",
      "pr.view",
      "pr.list",
      "pr.comments.list",
      "pr.reviews.list",
      "pr.diff.list_files",
      "pr.status.checks",
      "pr.checks.get_failed",
      "pr.mergeability.view",
      "pr.comment.reply",
      "pr.comment.resolve",
      "pr.comment.unresolve",
      "pr.ready_for_review.set",
      "check_run.annotations.list",
      "workflow_runs.list",
      "workflow_run.jobs.list",
      "workflow_job.logs.get",
      "workflow_job.logs.analyze",
      "workflow.list",
      "workflow.get",
      "workflow_run.get",
      "workflow_run.rerun_all",
      "workflow_run.cancel",
      "workflow_run.artifacts.list",
      "project_v2.org.get",
      "project_v2.user.get",
      "project_v2.fields.list",
      "project_v2.items.list",
      "project_v2.item.add_issue",
      "project_v2.item.field.update"
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
    const prCommentsCard = getOperationCard("pr.comments.list")

    expect(issueListCard?.input_schema.required).toEqual(["owner", "name"])
    expect(prListCard?.input_schema.required).toEqual(["owner", "name"])
    expect(prCommentsCard?.input_schema.required).toEqual(["owner", "name", "prNumber"])
  })

  it("supports unresolved and outdated filters for pr.comments.list", () => {
    const card = getOperationCard("pr.comments.list")
    const properties = card?.input_schema.properties as Record<string, unknown>

    expect(properties.unresolvedOnly).toEqual({ type: "boolean" })
    expect(properties.includeOutdated).toEqual({ type: "boolean" })
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
