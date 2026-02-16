import { describe, expect, it } from "vitest"

import {
  getOperationCard,
  listOperationCards,
  validateOperationCard,
} from "../../src/core/registry/index.js"

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
      "pr.review.submit_approve",
      "pr.review.submit_request_changes",
      "pr.review.submit_comment",
      "pr.merge.execute",
      "pr.checks.rerun_failed",
      "pr.checks.rerun_all",
      "pr.reviewers.request",
      "pr.assignees.update",
      "pr.branch.update",
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
      "project_v2.item.field.update",
      "release.list",
      "release.get",
      "release.create_draft",
      "release.update",
      "release.publish_draft",
      "workflow_dispatch.run",
      "workflow_run.rerun_failed",
    ])
  })

  it("marks release and delivery batch cards as CLI-preferred", () => {
    const releaseCreateDraft = getOperationCard("release.create_draft")
    const releasePublishDraft = getOperationCard("release.publish_draft")
    const workflowDispatchRun = getOperationCard("workflow_dispatch.run")
    const workflowRunRerunFailed = getOperationCard("workflow_run.rerun_failed")

    expect(releaseCreateDraft?.routing.preferred).toBe("cli")
    expect(releasePublishDraft?.routing.preferred).toBe("cli")
    expect(workflowDispatchRun?.routing.preferred).toBe("cli")
    expect(workflowRunRerunFailed?.routing.preferred).toBe("cli")
  })

  it("marks Projects v2 and repo issue types as GraphQL-preferred with CLI fallback", () => {
    const projectOrg = getOperationCard("project_v2.org.get")
    const projectUser = getOperationCard("project_v2.user.get")
    const projectFields = getOperationCard("project_v2.fields.list")
    const projectItems = getOperationCard("project_v2.items.list")
    const projectItemAddIssue = getOperationCard("project_v2.item.add_issue")
    const projectItemFieldUpdate = getOperationCard("project_v2.item.field.update")
    const issueTypes = getOperationCard("repo.issue_types.list")

    expect(projectOrg?.routing.preferred).toBe("graphql")
    expect(projectUser?.routing.preferred).toBe("graphql")
    expect(projectFields?.routing.preferred).toBe("graphql")
    expect(projectItems?.routing.preferred).toBe("graphql")
    expect(projectItemAddIssue?.routing.preferred).toBe("graphql")
    expect(projectItemFieldUpdate?.routing.preferred).toBe("graphql")
    expect(issueTypes?.routing.preferred).toBe("graphql")

    expect(projectOrg?.routing.fallbacks).toEqual(["cli"])
    expect(projectUser?.routing.fallbacks).toEqual(["cli"])
    expect(projectFields?.routing.fallbacks).toEqual(["cli"])
    expect(projectItems?.routing.fallbacks).toEqual(["cli"])
    expect(projectItemAddIssue?.routing.fallbacks).toEqual(["cli"])
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

  it("fails validation for malformed cards", () => {
    const result = validateOperationCard({
      capability_id: "broken.card",
    })

    expect(result.ok).toBe(false)
  })

  it("documents Batch A execution capabilities as mutating CLI operations", () => {
    const batchACapabilities = [
      "pr.review.submit_approve",
      "pr.review.submit_request_changes",
      "pr.review.submit_comment",
      "pr.merge.execute",
      "pr.checks.rerun_failed",
      "pr.checks.rerun_all",
      "pr.reviewers.request",
      "pr.assignees.update",
      "pr.branch.update",
    ]

    for (const capabilityId of batchACapabilities) {
      const card = getOperationCard(capabilityId)

      expect(card).toBeDefined()
      expect(card?.routing.preferred).toBe("cli")
      expect(card?.routing.fallbacks).toEqual([])
      expect(card?.cli?.command).toMatch(/^pr |^run /)
    }
  })
})
