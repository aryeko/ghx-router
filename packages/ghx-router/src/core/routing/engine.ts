import { routePreferenceOrder } from "./policy.js"
import { capabilityRegistry } from "./capability-registry.js"
import type { ResultEnvelope } from "../contracts/envelope.js"
import type { TaskRequest } from "../contracts/task.js"
import { issueListTask } from "../contracts/tasks/issue.list.js"
import { issueViewTask } from "../contracts/tasks/issue.view.js"
import { prListTask } from "../contracts/tasks/pr.list.js"
import { prViewTask } from "../contracts/tasks/pr.view.js"
import { repoViewTask } from "../contracts/tasks/repo.view.js"
import { mapErrorToCode } from "../errors/map-error.js"
import { errorCodes } from "../errors/codes.js"
import { isRetryableErrorCode } from "../errors/retryability.js"
import type {
  GithubClient,
  IssueListInput,
  IssueViewInput,
  PrListInput,
  PrViewInput,
  RepoViewInput
} from "../../gql/client.js"
import type { RouteReasonCode } from "./reason-codes.js"
import { preflightCheck } from "../execution/preflight.js"
import { normalizeError, normalizeResult } from "../execution/normalizer.js"

export function chooseRoute(): (typeof routePreferenceOrder)[number] {
  return routePreferenceOrder[0]
}

function resolveRoutesForTask(task: string): ResultEnvelope["meta"]["source"][] {
  const capability = capabilityRegistry.find((entry) => entry.task === task)
  const ordered = new Set<ResultEnvelope["meta"]["source"]>()

  if (capability) {
    ordered.add(capability.defaultRoute)
    for (const fallbackRoute of capability.fallbackRoutes) {
      ordered.add(fallbackRoute)
    }
  }

  for (const route of routePreferenceOrder) {
    ordered.add(route)
  }

  return [...ordered]
}

type ExecutionDeps = {
  githubClient: Pick<
    GithubClient,
    "fetchRepoView" | "fetchIssueList" | "fetchIssueView" | "fetchPrList" | "fetchPrView"
  >
  githubToken?: string | null
  ghCliAvailable?: boolean
  ghAuthenticated?: boolean
  reason?: RouteReasonCode
}

const DEFAULT_REASON: RouteReasonCode = "output_shape_requirement"

export async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps
): Promise<ResultEnvelope> {
  const reason = deps.reason ?? DEFAULT_REASON
  const routes = resolveRoutesForTask(request.task)
  let lastRetryableError:
    | {
        code: string
        message: string
        route: ResultEnvelope["meta"]["source"]
      }
    | null = null
  let lastPreflightError:
    | {
        code: string
        message: string
        details: { route: ResultEnvelope["meta"]["source"] }
        retryable: boolean
        route: ResultEnvelope["meta"]["source"]
      }
    | null = null

  for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
    const route = routes[routeIndex] as ResultEnvelope["meta"]["source"]
    const hasNextRoute = routeIndex < routes.length - 1

    const preflightInput: Parameters<typeof preflightCheck>[0] = { route }
    if (deps.githubToken !== undefined) {
      preflightInput.githubToken = deps.githubToken
    }
    if (deps.ghCliAvailable !== undefined) {
      preflightInput.ghCliAvailable = deps.ghCliAvailable
    }
    if (deps.ghAuthenticated !== undefined) {
      preflightInput.ghAuthenticated = deps.ghAuthenticated
    }

    const preflightResult = preflightCheck(preflightInput)
    if (!preflightResult.ok) {
      if (hasNextRoute && route !== "graphql") {
        lastPreflightError = {
          code: preflightResult.code,
          message: preflightResult.message,
          details: preflightResult.details,
          retryable: preflightResult.retryable,
          route
        }
        continue
      }

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

    if (route !== "graphql") {
      if (hasNextRoute) {
        continue
      }

      return normalizeError(
        {
          code: errorCodes.ValidationFailed,
          message: `Route '${route}' is not implemented for task '${request.task}'`,
          details: { route, task: request.task },
          retryable: false
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

      if (request.task === issueListTask.id) {
        const data = await deps.githubClient.fetchIssueList(request.input as IssueListInput)
        return normalizeResult(data, route, reason)
      }

      if (request.task === prViewTask.id) {
        const data = await deps.githubClient.fetchPrView(request.input as PrViewInput)
        return normalizeResult(data, route, reason)
      }

      if (request.task === prListTask.id) {
        const data = await deps.githubClient.fetchPrList(request.input as PrListInput)
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
      const code = mapErrorToCode(error)
      const retryable = isRetryableErrorCode(code)
      if (retryable && hasNextRoute) {
        lastRetryableError = {
          code,
          message: error instanceof Error ? error.message : String(error),
          route
        }
        continue
      }

      return normalizeError(
        {
          code,
          message: error instanceof Error ? error.message : String(error),
          retryable
        },
        route,
        reason
      )
    }
  }

  if (lastRetryableError) {
    return normalizeError(
      {
        code: lastRetryableError.code,
        message: lastRetryableError.message,
        retryable: true
      },
      lastRetryableError.route,
      reason
    )
  }

  if (lastPreflightError) {
    return normalizeError(
      {
        code: lastPreflightError.code,
        message: lastPreflightError.message,
        details: lastPreflightError.details,
        retryable: lastPreflightError.retryable
      },
      lastPreflightError.route,
      reason
    )
  }

  const defaultRoute = routes[0] ?? chooseRoute()
  return normalizeError(
    {
      code: errorCodes.ValidationFailed,
      message: `No executable route available for task: ${request.task}`,
      retryable: false
    },
    defaultRoute,
    reason
  )
}
