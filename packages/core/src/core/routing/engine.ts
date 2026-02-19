import { buildBatchMutation } from "../../gql/batch.js"
import type { GithubClient } from "../../gql/client.js"
import type { ResultEnvelope, RouteSource } from "../contracts/envelope.js"
import type { TaskRequest } from "../contracts/task.js"
import { errorCodes } from "../errors/codes.js"
import { mapErrorToCode } from "../errors/map-error.js"
import { expandCompositeSteps } from "../execute/composite.js"
import { execute } from "../execute/execute.js"
import {
  type CliCapabilityId,
  type CliCommandRunner,
  runCliCapability,
} from "../execution/adapters/cli-capability-adapter.js"
import {
  type GraphqlCapabilityId,
  runGraphqlCapability,
} from "../execution/adapters/graphql-capability-adapter.js"
import { createSafeCliCommandRunner } from "../execution/cli/safe-runner.js"
import { normalizeError } from "../execution/normalizer.js"
import { preflightCheck } from "../execution/preflight.js"
import { getOperationCard } from "../registry/index.js"
import { routePreferenceOrder } from "./policy.js"
import type { RouteReasonCode } from "./reason-codes.js"

type ExecutionDeps = {
  githubClient: Pick<
    GithubClient,
    | "fetchRepoView"
    | "fetchIssueCommentsList"
    | "fetchIssueList"
    | "fetchIssueView"
    | "fetchPrList"
    | "fetchPrView"
    | "fetchPrCommentsList"
    | "fetchPrReviewsList"
    | "fetchPrDiffListFiles"
    | "fetchPrMergeStatus"
    | "replyToReviewThread"
    | "resolveReviewThread"
    | "unresolveReviewThread"
  > & {
    query?: GithubClient["query"]
  }
  githubToken?: string | null
  cliRunner?: CliCommandRunner
  ghCliAvailable?: boolean
  ghAuthenticated?: boolean
  skipGhPreflight?: boolean
  reason?: RouteReasonCode
}

const DEFAULT_REASON: RouteReasonCode = "DEFAULT_POLICY"

type CliEnvironmentState = {
  ghCliAvailable: boolean
  ghAuthenticated: boolean
}

const CLI_ENV_CACHE_TTL_MS = 30_000
const cliEnvironmentCache = new WeakMap<
  CliCommandRunner,
  { value: CliEnvironmentState; expiresAt: number }
>()
const cliEnvironmentInFlight = new WeakMap<CliCommandRunner, Promise<CliEnvironmentState>>()
const defaultCliRunner = createSafeCliCommandRunner()
async function detectCliEnvironment(runner: CliCommandRunner): Promise<CliEnvironmentState> {
  try {
    const version = await runner.run("gh", ["--version"], 1_500)
    if (version.exitCode !== 0) {
      return {
        ghCliAvailable: false,
        ghAuthenticated: false,
      }
    }

    const auth = await runner.run("gh", ["auth", "status"], 2_500)
    return {
      ghCliAvailable: true,
      ghAuthenticated: auth.exitCode === 0,
    }
  } catch {
    return {
      ghCliAvailable: false,
      ghAuthenticated: false,
    }
  }
}

async function detectCliEnvironmentCached(runner: CliCommandRunner): Promise<CliEnvironmentState> {
  const now = Date.now()
  const cached = cliEnvironmentCache.get(runner)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const inFlight = cliEnvironmentInFlight.get(runner)
  if (inFlight) {
    return inFlight
  }

  const probePromise = detectCliEnvironment(runner)
    .then((value) => {
      cliEnvironmentCache.set(runner, {
        value,
        expiresAt: Date.now() + CLI_ENV_CACHE_TTL_MS,
      })
      cliEnvironmentInFlight.delete(runner)
      return value
    })
    .catch((error) => {
      cliEnvironmentInFlight.delete(runner)
      throw error
    })

  cliEnvironmentInFlight.set(runner, probePromise)
  return probePromise
}

async function executeComposite(
  card: NonNullable<ReturnType<typeof getOperationCard>>,
  input: Record<string, unknown>,
  deps: ExecutionDeps,
  reason: RouteReasonCode,
): Promise<ResultEnvelope> {
  if (!card.composite) {
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: "Card does not have composite config",
        retryable: false,
      },
      "graphql",
      { capabilityId: card.capability_id, reason },
    )
  }

  try {
    // Expand composite steps into individual operations
    const expandedOperations = await expandCompositeSteps(card.composite, input)

    if (expandedOperations.length === 0) {
      return normalizeError(
        {
          code: errorCodes.Validation,
          message: "No operations to execute",
          retryable: false,
        },
        "graphql",
        { capabilityId: card.capability_id, reason },
      )
    }

    // Build batch mutation from expanded operations
    const batchInput = expandedOperations.map((op) => ({
      alias: op.alias,
      mutation: op.mutation,
      variables: op.variables,
    }))
    const { document, variables } = buildBatchMutation(batchInput)

    // Execute single GraphQL request
    if (!deps.githubClient.query) {
      return normalizeError(
        {
          code: errorCodes.AdapterUnsupported,
          message: "GitHub client query method not available for composite execution",
          retryable: false,
        },
        "graphql",
        { capabilityId: card.capability_id, reason },
      )
    }
    const batchResult = await deps.githubClient.query(document, variables)

    // Map results back through each builder's mapResponse
    const results: unknown[] = []
    const resultsByAlias = batchResult as Record<string, unknown>
    for (const op of expandedOperations) {
      const aliasedResult = resultsByAlias[op.alias]
      const mapped = op.mapResponse(aliasedResult)
      results.push(mapped)
    }

    // Aggregate results per output_strategy
    let aggregatedData: unknown
    if (card.composite.output_strategy === "array") {
      aggregatedData = { results }
    } else if (card.composite.output_strategy === "merge") {
      // Merge all results into a single object
      aggregatedData = Object.assign({}, ...results)
    } else if (card.composite.output_strategy === "last") {
      // Return only the last result
      aggregatedData = results[results.length - 1]
    }

    return {
      ok: true,
      data: aggregatedData,
      meta: {
        capability_id: card.capability_id,
        route_used: "graphql",
        reason,
      },
    }
  } catch (error) {
    const code = mapErrorToCode(error)
    const message = error instanceof Error ? error.message : String(error) || "Unknown error"
    return normalizeError(
      {
        code,
        message,
        retryable: code !== errorCodes.Validation,
      },
      "graphql",
      { capabilityId: card.capability_id, reason },
    )
  }
}

export async function executeTask(
  request: TaskRequest,
  deps: ExecutionDeps,
): Promise<ResultEnvelope> {
  const reason = deps.reason ?? DEFAULT_REASON
  const card = getOperationCard(request.task)
  if (!card) {
    return normalizeError(
      {
        code: errorCodes.Validation,
        message: `Unsupported task: ${request.task}`,
        retryable: false,
      },
      routePreferenceOrder[0],
      { capabilityId: request.task, reason },
    )
  }

  // Handle composite cards separately
  if (card.composite) {
    return executeComposite(card, request.input as Record<string, unknown>, deps, reason)
  }

  const cliRunner = deps.cliRunner ?? defaultCliRunner

  return execute({
    card,
    params: request.input as Record<string, unknown>,
    routingContext: {
      ghCliAvailable: deps.ghCliAvailable,
      ghAuthenticated: deps.ghAuthenticated,
      githubTokenPresent: Boolean(deps.githubToken),
    },
    retry: {
      maxAttemptsPerRoute: 2,
    },
    preflight: async (route: RouteSource) => {
      const preflightInput: Parameters<typeof preflightCheck>[0] = { route }
      if (deps.githubToken !== undefined) {
        preflightInput.githubToken = deps.githubToken
      }

      if (route === "cli") {
        if (deps.ghCliAvailable !== undefined) {
          preflightInput.ghCliAvailable = deps.ghCliAvailable
        }

        if (deps.ghAuthenticated !== undefined) {
          preflightInput.ghAuthenticated = deps.ghAuthenticated
        }

        if (
          preflightInput.ghCliAvailable === undefined ||
          preflightInput.ghAuthenticated === undefined
        ) {
          if (deps.skipGhPreflight === true) {
            if (preflightInput.ghCliAvailable === undefined) {
              preflightInput.ghCliAvailable = true
            }

            if (preflightInput.ghAuthenticated === undefined) {
              preflightInput.ghAuthenticated = true
            }
          } else {
            const detected = await detectCliEnvironmentCached(cliRunner)

            if (preflightInput.ghCliAvailable === undefined) {
              preflightInput.ghCliAvailable = detected.ghCliAvailable
            }

            if (preflightInput.ghAuthenticated === undefined) {
              preflightInput.ghAuthenticated = detected.ghAuthenticated
            }
          }
        }
      }

      return preflightCheck(preflightInput)
    },
    routes: {
      graphql: async () =>
        runGraphqlCapability(
          deps.githubClient,
          request.task as GraphqlCapabilityId,
          request.input as Record<string, unknown>,
        ),
      cli: async () => {
        return runCliCapability(
          cliRunner,
          request.task as CliCapabilityId,
          request.input as Record<string, unknown>,
          card,
        )
      },
      rest: async () =>
        normalizeError(
          {
            code: errorCodes.AdapterUnsupported,
            message: `Route 'rest' is not implemented for task '${request.task}'`,
            retryable: false,
            details: { route: "rest", task: request.task },
          },
          "rest",
          { capabilityId: request.task, reason },
        ),
    },
  })
}
