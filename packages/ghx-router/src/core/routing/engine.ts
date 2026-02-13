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

export function chooseRoute(): (typeof routePreferenceOrder)[number] {
  return routePreferenceOrder[0]
}

type ExecutionDeps = {
  githubClient: Pick<GithubClient, "fetchRepoView" | "fetchIssueView" | "fetchPrView">
  reason?: RouteReasonCode
}

const DEFAULT_REASON: RouteReasonCode = "output_shape_requirement"

function meta(reason: RouteReasonCode): ResultEnvelope["meta"] {
  return {
    source: "graphql",
    reason
  }
}

export async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps
): Promise<ResultEnvelope> {
  const reason = deps.reason ?? DEFAULT_REASON

  try {
    if (request.task === repoViewTask.id) {
      const data = await deps.githubClient.fetchRepoView(request.input as RepoViewInput)
      return { success: true, data, meta: meta(reason) }
    }

    if (request.task === issueViewTask.id) {
      const data = await deps.githubClient.fetchIssueView(request.input as IssueViewInput)
      return { success: true, data, meta: meta(reason) }
    }

    if (request.task === prViewTask.id) {
      const data = await deps.githubClient.fetchPrView(request.input as PrViewInput)
      return { success: true, data, meta: meta(reason) }
    }

    return {
      success: false,
      error: {
        code: errorCodes.ValidationFailed,
        message: `Unsupported task: ${request.task}`,
        retryable: false
      },
      meta: meta(reason)
    }
  } catch (error: unknown) {
    return {
      success: false,
      error: {
        code: mapErrorToCode(error),
        message: error instanceof Error ? error.message : String(error),
        retryable: false
      },
      meta: meta(reason)
    }
  }
}
