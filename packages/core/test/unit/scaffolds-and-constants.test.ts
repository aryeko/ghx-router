import { describe, expect, it } from "vitest"

import { MAIN_SKILL_TEXT } from "../../src/agent-interface/prompt/main-skill.js"
import { main } from "../../src/cli/index.js"
import { doctorCommand } from "../../src/cli/commands/doctor.js"
import { routesCommand } from "../../src/cli/commands/routes.js"
import { runCommand } from "../../src/cli/commands/run.js"
import { formatJson } from "../../src/cli/formatters/json.js"
import { formatTable } from "../../src/cli/formatters/table.js"
import { issueCommentsListTask } from "../../src/core/contracts/tasks/issue.comments.list.js"
import { issueListTask } from "../../src/core/contracts/tasks/issue.list.js"
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
import { prReviewSubmitApproveTask } from "../../src/core/contracts/tasks/pr.review.submit_approve.js"
import { prReviewSubmitRequestChangesTask } from "../../src/core/contracts/tasks/pr.review.submit_request_changes.js"
import { prReviewSubmitCommentTask } from "../../src/core/contracts/tasks/pr.review.submit_comment.js"
import { prMergeExecuteTask } from "../../src/core/contracts/tasks/pr.merge.execute.js"
import { prChecksRerunFailedTask } from "../../src/core/contracts/tasks/pr.checks.rerun_failed.js"
import { prChecksRerunAllTask } from "../../src/core/contracts/tasks/pr.checks.rerun_all.js"
import { prReviewersRequestTask } from "../../src/core/contracts/tasks/pr.reviewers.request.js"
import { prAssigneesUpdateTask } from "../../src/core/contracts/tasks/pr.assignees.update.js"
import { prBranchUpdateTask } from "../../src/core/contracts/tasks/pr.branch.update.js"
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
    expect(issueListTask.id).toBe("issue.list")
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
    expect(prReviewSubmitApproveTask.id).toBe("pr.review.submit_approve")
    expect(prReviewSubmitRequestChangesTask.id).toBe("pr.review.submit_request_changes")
    expect(prReviewSubmitCommentTask.id).toBe("pr.review.submit_comment")
    expect(prMergeExecuteTask.id).toBe("pr.merge.execute")
    expect(prChecksRerunFailedTask.id).toBe("pr.checks.rerun_failed")
    expect(prChecksRerunAllTask.id).toBe("pr.checks.rerun_all")
    expect(prReviewersRequestTask.id).toBe("pr.reviewers.request")
    expect(prAssigneesUpdateTask.id).toBe("pr.assignees.update")
    expect(prBranchUpdateTask.id).toBe("pr.branch.update")
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
