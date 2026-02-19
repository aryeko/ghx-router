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
      "issue.labels.update",
      "issue.labels.add",
      "issue.assignees.update",
      "issue.milestone.set",
      "issue.comments.create",
      "issue.linked_prs.list",
      "issue.relations.get",
      "issue.parent.set",
      "issue.parent.remove",
      "issue.blocked_by.add",
      "issue.blocked_by.remove",
      "pr.view",
      "pr.list",
      "pr.create",
      "pr.update",
      "pr.thread.list",
      "pr.thread.reply",
      "pr.thread.resolve",
      "pr.thread.unresolve",
      "pr.review.list",
      "pr.review.request",
      "pr.review.submit",
      "pr.diff.files",
      "pr.diff.view",
      "pr.checks.list",
      "pr.checks.failed",
      "pr.checks.rerun_failed",
      "pr.checks.rerun_all",
      "pr.merge.status",
      "pr.merge",
      "pr.assignees.update",
      "pr.branch.update",
      "check_run.annotations.list",
      "workflow.list",
      "workflow.get",
      "project_v2.org.get",
      "project_v2.user.get",
      "project_v2.fields.list",
      "project_v2.items.list",
      "project_v2.item.add_issue",
      "project_v2.item.field.update",
      "release.list",
      "release.get",
      "release.create_draft",
      "release.update",
      "release.publish_draft",
      "workflow.dispatch.run",
      "workflow.job.logs.get",
      "workflow.job.logs.raw",
      "workflow.run.artifacts.list",
      "workflow.run.cancel",

      "workflow.run.rerun_all",
      "workflow.run.rerun_failed",
      "workflow.run.view",
      "workflow.runs.list",
    ])
  })

  it("marks release and delivery batch cards as CLI-preferred", () => {
    const releaseCreateDraft = getOperationCard("release.create_draft")
    const releasePublishDraft = getOperationCard("release.publish_draft")
    const workflowDispatchRun = getOperationCard("workflow.dispatch.run")
    const workflowRunRerunFailed = getOperationCard("workflow.run.rerun_failed")

    expect(releaseCreateDraft?.routing.preferred).toBe("cli")
    expect(releasePublishDraft?.routing.preferred).toBe("cli")
    expect(workflowDispatchRun?.routing.preferred).toBe("cli")
    expect(workflowRunRerunFailed?.routing.preferred).toBe("cli")
  })

  it("marks Projects v2 and repo issue types as CLI-preferred with no fallbacks", () => {
    const projectOrg = getOperationCard("project_v2.org.get")
    const projectUser = getOperationCard("project_v2.user.get")
    const projectFields = getOperationCard("project_v2.fields.list")
    const projectItems = getOperationCard("project_v2.items.list")
    const projectItemAddIssue = getOperationCard("project_v2.item.add_issue")
    const projectItemFieldUpdate = getOperationCard("project_v2.item.field.update")
    const issueTypes = getOperationCard("repo.issue_types.list")

    expect(projectOrg?.routing.preferred).toBe("cli")
    expect(projectUser?.routing.preferred).toBe("cli")
    expect(projectFields?.routing.preferred).toBe("cli")
    expect(projectItems?.routing.preferred).toBe("cli")
    expect(projectItemAddIssue?.routing.preferred).toBe("cli")
    expect(projectItemFieldUpdate?.routing.preferred).toBe("cli")
    expect(issueTypes?.routing.preferred).toBe("cli")

    expect(projectOrg?.routing.fallbacks).toEqual([])
    expect(projectUser?.routing.fallbacks).toEqual([])
    expect(projectFields?.routing.fallbacks).toEqual([])
    expect(projectItems?.routing.fallbacks).toEqual([])
    expect(projectItemAddIssue?.routing.fallbacks).toEqual([])
    expect(projectItemFieldUpdate?.routing.fallbacks).toEqual([])
    expect(issueTypes?.routing.fallbacks).toEqual([])
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
    const prThreadCard = getOperationCard("pr.thread.list")

    expect(issueListCard?.input_schema.required).toEqual(["owner", "name"])
    expect(prListCard?.input_schema.required).toEqual(["owner", "name"])
    expect(prThreadCard?.input_schema.required).toEqual(["owner", "name", "prNumber"])
  })

  it("supports unresolved and outdated filters for pr.thread.list", () => {
    const card = getOperationCard("pr.thread.list")
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

  it("documents mutating PR capabilities as CLI-preferred operations", () => {
    const mutatingCapabilities = [
      "pr.review.submit",
      "pr.merge",
      "pr.create",
      "pr.update",
      "pr.checks.rerun_failed",
      "pr.checks.rerun_all",
      "pr.review.request",
      "pr.assignees.update",
      "pr.branch.update",
    ]

    for (const capabilityId of mutatingCapabilities) {
      const card = getOperationCard(capabilityId)

      expect(card).toBeDefined()
      expect(card?.routing.preferred).toBe("cli")
      expect(card?.routing.fallbacks).toEqual([])
      expect(card?.cli?.command).toMatch(/^pr |^run /)
    }
  })
})
