import type { ResultEnvelope, RouteSource } from "@core/core/contracts/envelope.js"
import type { TaskRequest } from "@core/core/contracts/task.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { execute } from "@core/core/execute/execute.js"
import {
  type CliCapabilityId,
  type CliCommandRunner,
  runCliCapability,
} from "@core/core/execution/adapters/cli-capability-adapter.js"
import { runGraphqlCapability } from "@core/core/execution/adapters/graphql-capability-adapter.js"
import { createSafeCliCommandRunner } from "@core/core/execution/cli/safe-runner.js"
import { normalizeError } from "@core/core/execution/normalizer.js"
import { preflightCheck } from "@core/core/execution/preflight.js"
import { getOperationCard } from "@core/core/registry/index.js"
import { routePreferenceOrder } from "@core/core/routing/policy.js"
import type { RouteReasonCode } from "@core/core/routing/reason-codes.js"
import type { GithubClient } from "@core/gql/github-client.js"

type ExecutionDeps = {
  githubClient: GithubClient
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
      graphql: async () => {
        return runGraphqlCapability(
          deps.githubClient,
          request.task,
          request.input as Record<string, unknown>,
        )
      },
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
