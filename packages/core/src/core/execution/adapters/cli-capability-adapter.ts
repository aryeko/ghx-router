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
  | "issue.labels.remove"
  | "issue.assignees.add"
  | "issue.assignees.remove"
  | "issue.milestone.clear"
  | "pr.view"
  | "pr.list"
  | "pr.create"
  | "pr.update"
  | "pr.checks.list"
  | "pr.checks.rerun.failed"
  | "pr.checks.rerun.all"
  | "pr.merge.status"
  | "pr.reviews.submit"
  | "pr.merge"
  | "pr.reviews.request"
  | "pr.assignees.add"
  | "pr.assignees.remove"
  | "pr.branch.update"
  | "pr.diff.view"
  | "pr.diff.files"
  | "workflow.runs.list"
  | "workflow.job.logs.raw"
  | "workflow.job.logs.view"
  | "workflow.list"
  | "workflow.view"
  | "workflow.run.view"
  | "workflow.run.rerun.all"
  | "workflow.run.cancel"
  | "workflow.run.artifacts.list"
  | "workflow.dispatch"
  | "workflow.run.rerun.failed"
  | "project_v2.org.view"
  | "project_v2.user.view"
  | "project_v2.fields.list"
  | "project_v2.items.list"
  | "project_v2.items.issue.add"
  | "project_v2.items.issue.remove"
  | "project_v2.items.field.update"
  | "release.list"
  | "release.view"
  | "release.create"
  | "release.update"
  | "release.publish"

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
