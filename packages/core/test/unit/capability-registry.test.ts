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
        defaultRoute: "cli",
        fallbackRoutes: [],
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
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.user.get",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.fields.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.items.list",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.item.add_issue",
        defaultRoute: "cli",
        fallbackRoutes: [],
      },
      {
        task: "project_v2.item.field.update",
        defaultRoute: "cli",
        fallbackRoutes: [],
      }
    ])
  })
})
