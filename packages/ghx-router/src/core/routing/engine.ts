import { routePreferenceOrder } from "./policy.js"
import type { ResultEnvelope } from "../contracts/envelope.js"
import type { TaskRequest } from "../contracts/task.js"
import { issueViewTask } from "../contracts/tasks/issue.view.js"
import { prViewTask } from "../contracts/tasks/pr.view.js"
import { repoViewTask } from "../contracts/tasks/repo.view.js"
import { mapErrorToCode } from "../errors/map-error.js"
import { errorCodes } from "../errors/codes.js"
import type {
  GithubClient,
  IssueViewInput,
  PrViewInput,
  RepoViewInput
} from "../../gql/client.js"
import type { RouteReasonCode } from "./reason-codes.js"
import { preflightCheck } from "../execution/preflight.js"
import { normalizeError, normalizeResult } from "../execution/normalizer.js"

export function chooseRoute(): (typeof routePreferenceOrder)[number] {
  return routePreferenceOrder[0]
}

type ExecutionDeps = {
  githubClient: Pick<GithubClient, "fetchRepoView" | "fetchIssueView" | "fetchPrView">
  githubToken?: string | null
  reason?: RouteReasonCode
}

const DEFAULT_REASON: RouteReasonCode = "output_shape_requirement"

export async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps
): Promise<ResultEnvelope> {
  const reason = deps.reason ?? DEFAULT_REASON
  const route: ResultEnvelope["meta"]["source"] = "graphql"
  const preflightInput =
    deps.githubToken === undefined
      ? { route }
      : { route, githubToken: deps.githubToken }
  const preflightResult = preflightCheck(preflightInput)
  if (!preflightResult.ok) {
    return normalizeError(
      {
        code: preflightResult.code,
        message: preflightResult.message,
        details: preflightResult.details,
        retryable: preflightResult.retryable
      },
      route,
      reason
    )
  }

  try {
    if (request.task === repoViewTask.id) {
      const data = await deps.githubClient.fetchRepoView(request.input as RepoViewInput)
      return normalizeResult(data, route, reason)
    }

    if (request.task === issueViewTask.id) {
      const data = await deps.githubClient.fetchIssueView(request.input as IssueViewInput)
      return normalizeResult(data, route, reason)
    }

    if (request.task === prViewTask.id) {
      const data = await deps.githubClient.fetchPrView(request.input as PrViewInput)
      return normalizeResult(data, route, reason)
    }

    return normalizeError(
      {
        code: errorCodes.ValidationFailed,
        message: `Unsupported task: ${request.task}`,
        retryable: false
      },
      route,
      reason
    )
  } catch (error: unknown) {
    return normalizeError(
      {
        code: mapErrorToCode(error),
        message: error instanceof Error ? error.message : String(error),
        retryable: false
      },
      route,
      reason
    )
  }
}
