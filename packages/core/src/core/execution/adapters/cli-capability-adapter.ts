import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import type { OperationCard } from "@core/core/registry/types.js"
import { normalizeError } from "../normalizer.js"
import { getCliHandler } from "./cli/capability-registry.js"
import type { CliCommandRunner } from "./cli-adapter.js"

export type { CliCommandRunner }

export type CliCapabilityId =
  | "repo.view"
  | "repo.labels.list"
  | "repo.issue_types.list"
  | "issue.view"
  | "issue.list"
  | "issue.comments.list"
  | "pr.view"
  | "pr.list"
  | "pr.create"
  | "pr.update"
  | "pr.checks.list"
  | "pr.checks.failed"
  | "pr.merge.status"
  | "pr.review.submit"
  | "pr.merge"
  | "pr.checks.rerun_failed"
  | "pr.checks.rerun_all"
  | "pr.review.request"
  | "pr.assignees.update"
  | "pr.branch.update"
  | "pr.diff.view"
  | "pr.diff.files"
  | "check_run.annotations.list"
  | "workflow.runs.list"
  | "workflow.job.logs.raw"
  | "workflow.job.logs.get"
  | "workflow.list"
  | "workflow.get"
  | "workflow.run.view"
  | "workflow.run.rerun_all"
  | "workflow.run.cancel"
  | "workflow.run.artifacts.list"
  | "workflow.dispatch.run"
  | "workflow.run.rerun_failed"
  | "project_v2.org.get"
  | "project_v2.user.get"
  | "project_v2.fields.list"
  | "project_v2.items.list"
  | "project_v2.item.add_issue"
  | "project_v2.item.field.update"
  | "release.list"
  | "release.get"
  | "release.create_draft"
  | "release.update"
  | "release.publish_draft"

export async function runCliCapability(
  runner: CliCommandRunner,
  capabilityId: CliCapabilityId,
  params: Record<string, unknown>,
  card?: OperationCard,
): Promise<ResultEnvelope> {
  const handler = getCliHandler(capabilityId)
  if (handler === undefined) {
    return normalizeError(
      {
        code: errorCodes.NotFound,
        message: `No CLI handler registered for capability: ${capabilityId}`,
        retryable: false,
      },
      "cli",
      { capabilityId, reason: "CARD_FALLBACK" },
    )
  }
  return handler(runner, params, card)
}
