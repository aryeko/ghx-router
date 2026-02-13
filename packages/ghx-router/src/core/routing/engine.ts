import { routePreferenceOrder } from "./policy.js"
import type { ResultEnvelope, RouteSource } from "../contracts/envelope.js"
import type { TaskRequest } from "../contracts/task.js"
import { errorCodes } from "../errors/codes.js"
import type { GithubClient } from "../../gql/client.js"
import type { RouteReasonCode } from "./reason-codes.js"
import { preflightCheck } from "../execution/preflight.js"
import { normalizeError } from "../execution/normalizer.js"
import { execute } from "../execute/execute.js"
import { getOperationCard } from "../registry/index.js"
import { runGraphqlCapability, type GraphqlCapabilityId } from "../execution/adapters/graphql-capability-adapter.js"
import { runCliCapability, type CliCapabilityId, type CliCommandRunner } from "../execution/adapters/cli-capability-adapter.js"

export function chooseRoute(): (typeof routePreferenceOrder)[number] {
  return routePreferenceOrder[0]
}

type ExecutionDeps = {
  githubClient: Pick<
    GithubClient,
    "fetchRepoView" | "fetchIssueList" | "fetchIssueView" | "fetchPrList" | "fetchPrView"
  >
  githubToken?: string | null
  cliRunner?: CliCommandRunner
  ghCliAvailable?: boolean
  ghAuthenticated?: boolean
  reason?: RouteReasonCode
}

const DEFAULT_REASON: RouteReasonCode = "DEFAULT_POLICY"

export async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps
): Promise<ResultEnvelope> {
  const reason = deps.reason ?? DEFAULT_REASON
  const card = getOperationCard(request.task)
  if (!card) {
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Unsupported task: ${request.task}`,
        retryable: false
      },
      chooseRoute(),
      { capabilityId: request.task, reason }
    )
  }

  return execute({
    card,
    params: request.input as Record<string, unknown>,
    retry: {
      maxAttemptsPerRoute: 2
    },
    preflight: async (route: RouteSource) => {
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

      return preflightCheck(preflightInput)
    },
    routes: {
      graphql: async () =>
        runGraphqlCapability(deps.githubClient, request.task as GraphqlCapabilityId, request.input as Record<string, unknown>),
      cli: async () => {
        if (!deps.cliRunner) {
          return normalizeError(
            {
              code: errorCodes.AdapterUnsupported,
              message: `Route 'cli' is not available for task '${request.task}'`,
              retryable: false,
              details: { route: "cli", task: request.task }
            },
            "cli",
            { capabilityId: request.task, reason }
          )
        }

        return runCliCapability(deps.cliRunner, request.task as CliCapabilityId, request.input as Record<string, unknown>)
      },
      rest: async () =>
        normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: `Route 'rest' is not implemented for task '${request.task}'`,
            retryable: false,
            details: { route: "rest", task: request.task }
          },
          "rest",
          { capabilityId: request.task, reason }
        )
    }
  })
}
