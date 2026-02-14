import { describe, expect, it } from "vitest"

import { capabilityRegistry } from "../../src/core/routing/capability-registry.js"

describe("capabilityRegistry", () => {
  it("is generated from operation cards with deterministic route order", () => {
    expect(capabilityRegistry).toEqual([
      {
        task: "repo.view",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "repo.labels.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "repo.issue_types.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "issue.view",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "issue.list",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "issue.comments.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"]
      },
      {
        task: "issue.create",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.update",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.close",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.reopen",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.delete",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.labels.update",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.assignees.update",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.milestone.set",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.comments.create",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.linked_prs.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.relations.get",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.parent.set",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.parent.remove",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.blocked_by.add",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "issue.blocked_by.remove",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.view",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "pr.list",
        defaultRoute: "cli",
        fallbackRoutes: ["graphql"]
      },
      {
        task: "pr.comments.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.reviews.list",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.diff.list_files",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.status.checks",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.checks.get_failed",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.mergeability.view",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.comment.reply",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.comment.resolve",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.comment.unresolve",
        defaultRoute: "graphql",
        fallbackRoutes: [],
      },
      {
        task: "pr.ready_for_review.set",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.review.submit_approve",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.review.submit_request_changes",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.review.submit_comment",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.merge.execute",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.checks.rerun_failed",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.checks.rerun_all",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.reviewers.request",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.assignees.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "pr.branch.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "check_run.annotations.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_runs.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_run.jobs.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_job.logs.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_job.logs.analyze",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_run.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_run.rerun_all",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_run.cancel",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_run.artifacts.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.org.get",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "project_v2.user.get",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "project_v2.fields.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "project_v2.items.list",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "project_v2.item.add_issue",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "project_v2.item.field.update",
        defaultRoute: "graphql",
        fallbackRoutes: ["cli"],
      },
      {
        task: "release.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.create_draft",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "release.publish_draft",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_dispatch.run",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "workflow_run.rerun_failed",
        defaultRoute: "cli",
        fallbackRoutes: [],
      }
    ])
  })
})
