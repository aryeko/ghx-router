import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  getOperationCard,
  listOperationCards,
  validateOperationCard,
} from "@core/core/registry/index.js"
import { describe, expect, it } from "vitest"

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
      "issue.create",
      "issue.update",
      "issue.close",
      "issue.reopen",
      "issue.delete",
      "issue.labels.set",
      "issue.labels.add",
      "issue.labels.remove",
      "issue.assignees.set",
      "issue.assignees.add",
      "issue.assignees.remove",
      "issue.milestone.set",
      "issue.milestone.clear",
      "issue.comments.create",
      "issue.relations.prs.list",
      "issue.relations.view",
      "issue.relations.parent.set",
      "issue.relations.parent.remove",
      "issue.relations.blocked_by.add",
      "issue.relations.blocked_by.remove",
      "pr.view",
      "pr.list",
      "pr.create",
      "pr.update",
      "pr.threads.list",
      "pr.threads.reply",
      "pr.threads.resolve",
      "pr.threads.unresolve",
      "pr.reviews.list",
      "pr.reviews.request",
      "pr.reviews.submit",
      "pr.diff.files",
      "pr.diff.view",
      "pr.checks.list",
      "pr.checks.rerun.failed",
      "pr.checks.rerun.all",
      "pr.merge.status",
      "pr.merge",
      "pr.assignees.add",
      "pr.assignees.remove",
      "pr.branch.update",
      "workflow.list",
      "workflow.view",
      "project_v2.org.view",
      "project_v2.user.view",
      "project_v2.fields.list",
      "project_v2.items.list",
      "project_v2.items.issue.add",
      "project_v2.items.issue.remove",
      "project_v2.items.field.update",
      "release.list",
      "release.view",
      "release.create",
      "release.update",
      "release.publish",
      "workflow.dispatch",
      "workflow.job.logs.view",
      "workflow.job.logs.raw",
      "workflow.run.artifacts.list",
      "workflow.run.cancel",

      "workflow.run.rerun.all",
      "workflow.run.rerun.failed",
      "workflow.run.view",
      "workflow.runs.list",
    ])
  })

  it("marks release and delivery batch cards as CLI-preferred", () => {
    const releaseCreateDraft = getOperationCard("release.create")
    const releasePublishDraft = getOperationCard("release.publish")
    const workflowDispatchRun = getOperationCard("workflow.dispatch")
    const workflowRunRerunFailed = getOperationCard("workflow.run.rerun.failed")

    expect(releaseCreateDraft?.routing.preferred).toBe("cli")
    expect(releasePublishDraft?.routing.preferred).toBe("cli")
    expect(workflowDispatchRun?.routing.preferred).toBe("cli")
    expect(workflowRunRerunFailed?.routing.preferred).toBe("cli")
  })

  it("marks Projects v2 query caps as graphql-preferred and mutation caps as graphql-preferred with cli fallback", () => {
    const projectOrg = getOperationCard("project_v2.org.view")
    const projectUser = getOperationCard("project_v2.user.view")
    const projectFields = getOperationCard("project_v2.fields.list")
    const projectItems = getOperationCard("project_v2.items.list")
    const projectItemAddIssue = getOperationCard("project_v2.items.issue.add")
    const projectItemRemoveIssue = getOperationCard("project_v2.items.issue.remove")
    const projectItemFieldUpdate = getOperationCard("project_v2.items.field.update")
    const issueTypes = getOperationCard("repo.issue_types.list")

    expect(projectOrg?.routing.preferred).toBe("graphql")
    expect(projectUser?.routing.preferred).toBe("graphql")
    expect(projectFields?.routing.preferred).toBe("graphql")
    expect(projectItems?.routing.preferred).toBe("graphql")
    expect(projectItemAddIssue?.routing.preferred).toBe("graphql")
    expect(projectItemRemoveIssue?.routing.preferred).toBe("graphql")
    expect(projectItemFieldUpdate?.routing.preferred).toBe("graphql")
    expect(issueTypes?.routing.preferred).toBe("graphql")

    expect(projectOrg?.routing.fallbacks).toEqual(["cli"])
    expect(projectUser?.routing.fallbacks).toEqual(["cli"])
    expect(projectFields?.routing.fallbacks).toEqual(["cli"])
    expect(projectItems?.routing.fallbacks).toEqual(["cli"])
    expect(projectItemAddIssue?.routing.fallbacks).toEqual(["cli"])
    expect(projectItemRemoveIssue?.routing.fallbacks).toEqual(["cli"])
    expect(projectItemFieldUpdate?.routing.fallbacks).toEqual(["cli"])
    expect(issueTypes?.routing.fallbacks).toEqual(["cli"])
  })

  it("resolves cards by capability id", () => {
    const card = getOperationCard("issue.create")

    expect(card).toBeDefined()
    expect(card?.routing.preferred).toBe("graphql")
    expect(card?.routing.fallbacks).toEqual([])
  })

  it("requires explicit pagination input for issue.comments.list", () => {
    const card = getOperationCard("issue.comments.list")
    expect(card?.input_schema.required).toEqual(["owner", "name", "issueNumber", "first"])
  })

  it("requires explicit pagination input for list capabilities", () => {
    const issueListCard = getOperationCard("issue.list")
    const prListCard = getOperationCard("pr.list")
    const prThreadCard = getOperationCard("pr.threads.list")

    expect(issueListCard?.input_schema.required).toEqual(["owner", "name"])
    expect(prListCard?.input_schema.required).toEqual(["owner", "name"])
    expect(prThreadCard?.input_schema.required).toEqual(["owner", "name", "prNumber"])
  })

  it("supports unresolved and outdated filters for pr.threads.list", () => {
    const card = getOperationCard("pr.threads.list")
    const properties = card?.input_schema.properties as Record<string, unknown>

    expect(properties.unresolvedOnly).toEqual({ type: "boolean" })
    expect(properties.includeOutdated).toEqual({ type: "boolean" })
  })

  it("exposes CLI command metadata for card-driven adapter execution", () => {
    const card = getOperationCard("issue.comments.list")
    expect(card?.cli).toEqual(
      expect.objectContaining({
        command: "api graphql",
      }),
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
        expect.stringContaining("cursor pagination"),
      ]),
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

  it("references existing graphql documents for graphql-capable cards", () => {
    const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
    const cards = listOperationCards()

    for (const card of cards) {
      if (!card.graphql?.documentPath) {
        continue
      }
      const documentPath = join(packageRoot, card.graphql.documentPath)
      expect(existsSync(documentPath)).toBe(true)
    }
  })

  it("fails validation for malformed cards", () => {
    const result = validateOperationCard({
      capability_id: "broken.card",
    })

    expect(result.ok).toBe(false)
  })

  it("documents mutating PR capabilities as graphql-preferred operations with cli fallback", () => {
    const mutatingCapabilities = [
      "pr.merge",
      "pr.create",
      "pr.update",
      "pr.reviews.request",
      "pr.assignees.add",
      "pr.assignees.remove",
      "pr.branch.update",
    ]

    for (const capabilityId of mutatingCapabilities) {
      const card = getOperationCard(capabilityId)

      expect(card).toBeDefined()
      expect(card?.routing.preferred).toBe("graphql")
      expect(card?.routing.fallbacks).toEqual(["cli"])
      expect(card?.cli?.command).toMatch(/^pr |^run /)
    }
  })

  it("documents CLI-only PR check rerun capabilities as CLI-preferred", () => {
    const cliOnlyCapabilities = ["pr.checks.rerun.failed", "pr.checks.rerun.all"]

    for (const capabilityId of cliOnlyCapabilities) {
      const card = getOperationCard(capabilityId)

      expect(card).toBeDefined()
      expect(card?.routing.preferred).toBe("cli")
      expect(card?.routing.fallbacks).toEqual([])
      expect(card?.cli?.command).toMatch(/^pr |^run /)
    }
  })

  it("pr.reviews.submit prefers GraphQL for inline comments support", () => {
    const card = getOperationCard("pr.reviews.submit")
    expect(card).toBeDefined()
    expect(card?.routing.preferred).toBe("graphql")
    expect(card?.routing.fallbacks).toEqual([])
    expect(card?.graphql).toBeDefined()
  })
})
