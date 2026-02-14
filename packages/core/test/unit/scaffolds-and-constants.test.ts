import { describe, expect, it } from "vitest"

import { MAIN_SKILL_TEXT } from "../../src/agent-interface/prompt/main-skill.js"
import { main } from "../../src/cli/index.js"
import { doctorCommand } from "../../src/cli/commands/doctor.js"
import { routesCommand } from "../../src/cli/commands/routes.js"
import { runCommand } from "../../src/cli/commands/run.js"
import { formatJson } from "../../src/cli/formatters/json.js"
import { formatTable } from "../../src/cli/formatters/table.js"
import { issueCommentsListTask } from "../../src/core/contracts/tasks/issue.comments.list.js"
import { issueCommentsCreateTask } from "../../src/core/contracts/tasks/issue.comments.create.js"
import { issueListTask } from "../../src/core/contracts/tasks/issue.list.js"
import { issueCreateTask } from "../../src/core/contracts/tasks/issue.create.js"
import { issueUpdateTask } from "../../src/core/contracts/tasks/issue.update.js"
import { issueCloseTask } from "../../src/core/contracts/tasks/issue.close.js"
import { issueReopenTask } from "../../src/core/contracts/tasks/issue.reopen.js"
import { issueDeleteTask } from "../../src/core/contracts/tasks/issue.delete.js"
import { issueLabelsUpdateTask } from "../../src/core/contracts/tasks/issue.labels.update.js"
import { issueAssigneesUpdateTask } from "../../src/core/contracts/tasks/issue.assignees.update.js"
import { issueMilestoneSetTask } from "../../src/core/contracts/tasks/issue.milestone.set.js"
import { issueLinkedPrsListTask } from "../../src/core/contracts/tasks/issue.linked_prs.list.js"
import { issueRelationsGetTask } from "../../src/core/contracts/tasks/issue.relations.get.js"
import { issueParentSetTask } from "../../src/core/contracts/tasks/issue.parent.set.js"
import { issueParentRemoveTask } from "../../src/core/contracts/tasks/issue.parent.remove.js"
import { issueBlockedByAddTask } from "../../src/core/contracts/tasks/issue.blocked_by.add.js"
import { issueBlockedByRemoveTask } from "../../src/core/contracts/tasks/issue.blocked_by.remove.js"
import { issueViewTask } from "../../src/core/contracts/tasks/issue.view.js"
import { prListTask } from "../../src/core/contracts/tasks/pr.list.js"
import { prViewTask } from "../../src/core/contracts/tasks/pr.view.js"
import { prCommentsListTask } from "../../src/core/contracts/tasks/pr.comments.list.js"
import { prReviewsListTask } from "../../src/core/contracts/tasks/pr.reviews.list.js"
import { prDiffListFilesTask } from "../../src/core/contracts/tasks/pr.diff.list_files.js"
import { prStatusChecksTask } from "../../src/core/contracts/tasks/pr.status.checks.js"
import { prChecksGetFailedTask } from "../../src/core/contracts/tasks/pr.checks.get_failed.js"
import { prMergeabilityViewTask } from "../../src/core/contracts/tasks/pr.mergeability.view.js"
import { prCommentReplyTask } from "../../src/core/contracts/tasks/pr.comment.reply.js"
import { prCommentResolveTask } from "../../src/core/contracts/tasks/pr.comment.resolve.js"
import { prCommentUnresolveTask } from "../../src/core/contracts/tasks/pr.comment.unresolve.js"
import { prReadyForReviewSetTask } from "../../src/core/contracts/tasks/pr.ready_for_review.set.js"
import { checkRunAnnotationsListTask } from "../../src/core/contracts/tasks/check_run.annotations.list.js"
import { workflowRunsListTask } from "../../src/core/contracts/tasks/workflow_runs.list.js"
import { workflowRunJobsListTask } from "../../src/core/contracts/tasks/workflow_run.jobs.list.js"
import { workflowJobLogsGetTask } from "../../src/core/contracts/tasks/workflow_job.logs.get.js"
import { workflowJobLogsAnalyzeTask } from "../../src/core/contracts/tasks/workflow_job.logs.analyze.js"
import { repoViewTask } from "../../src/core/contracts/tasks/repo.view.js"
import { routeReasonCodes } from "../../src/core/routing/reason-codes.js"
import { runRestAdapter } from "../../src/core/execution/adapters/rest-adapter.js"
import { projectName } from "../../src/shared/constants.js"
import { isObject } from "../../src/shared/utils.js"

describe("scaffolds and constants", () => {
  it("keeps main skill prompt text stable", () => {
    expect(MAIN_SKILL_TEXT).toContain("execute(capability_id, params)")
    expect(MAIN_SKILL_TEXT).toContain("ResultEnvelope")
  })

  it("executes scaffold command entrypoints without throwing", () => {
    expect(() => main()).not.toThrow()
    expect(() => doctorCommand()).not.toThrow()
    expect(() => routesCommand()).not.toThrow()
    expect(() => runCommand()).not.toThrow()
  })

  it("formats simple outputs", () => {
    expect(formatJson({ a: 1 })).toContain("\"a\": 1")
    expect(formatTable([{ a: 1 }])).toContain("not implemented")
  })

  it("exposes task identifiers and routing reasons", () => {
    expect(issueCommentsListTask.id).toBe("issue.comments.list")
    expect(issueCommentsCreateTask.id).toBe("issue.comments.create")
    expect(issueListTask.id).toBe("issue.list")
    expect(issueCreateTask.id).toBe("issue.create")
    expect(issueUpdateTask.id).toBe("issue.update")
    expect(issueCloseTask.id).toBe("issue.close")
    expect(issueReopenTask.id).toBe("issue.reopen")
    expect(issueDeleteTask.id).toBe("issue.delete")
    expect(issueLabelsUpdateTask.id).toBe("issue.labels.update")
    expect(issueAssigneesUpdateTask.id).toBe("issue.assignees.update")
    expect(issueMilestoneSetTask.id).toBe("issue.milestone.set")
    expect(issueLinkedPrsListTask.id).toBe("issue.linked_prs.list")
    expect(issueRelationsGetTask.id).toBe("issue.relations.get")
    expect(issueParentSetTask.id).toBe("issue.parent.set")
    expect(issueParentRemoveTask.id).toBe("issue.parent.remove")
    expect(issueBlockedByAddTask.id).toBe("issue.blocked_by.add")
    expect(issueBlockedByRemoveTask.id).toBe("issue.blocked_by.remove")
    expect(issueViewTask.id).toBe("issue.view")
    expect(prListTask.id).toBe("pr.list")
    expect(prViewTask.id).toBe("pr.view")
    expect(prCommentsListTask.id).toBe("pr.comments.list")
    expect(prReviewsListTask.id).toBe("pr.reviews.list")
    expect(prDiffListFilesTask.id).toBe("pr.diff.list_files")
    expect(prStatusChecksTask.id).toBe("pr.status.checks")
    expect(prChecksGetFailedTask.id).toBe("pr.checks.get_failed")
    expect(prMergeabilityViewTask.id).toBe("pr.mergeability.view")
    expect(prCommentReplyTask.id).toBe("pr.comment.reply")
    expect(prCommentResolveTask.id).toBe("pr.comment.resolve")
    expect(prCommentUnresolveTask.id).toBe("pr.comment.unresolve")
    expect(prReadyForReviewSetTask.id).toBe("pr.ready_for_review.set")
    expect(checkRunAnnotationsListTask.id).toBe("check_run.annotations.list")
    expect(workflowRunsListTask.id).toBe("workflow_runs.list")
    expect(workflowRunJobsListTask.id).toBe("workflow_run.jobs.list")
    expect(workflowJobLogsGetTask.id).toBe("workflow_job.logs.get")
    expect(workflowJobLogsAnalyzeTask.id).toBe("workflow_job.logs.analyze")
    expect(repoViewTask.id).toBe("repo.view")
    expect(routeReasonCodes).toContain("CARD_FALLBACK")
  })

  it("exports shared utility primitives", () => {
    expect(projectName).toBe("ghx")
    expect(isObject({})).toBe(true)
    expect(isObject([])).toBe(false)
    expect(isObject(null)).toBe(false)
  })

  it("throws for unimplemented rest adapter", async () => {
    await expect(runRestAdapter()).rejects.toThrow("not implemented")
  })
})
