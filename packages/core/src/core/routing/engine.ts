import type {
  ChainResultEnvelope,
  ChainStatus,
  ChainStepResult,
  ResultEnvelope,
  RouteSource,
} from "@core/core/contracts/envelope.js"
import type { TaskRequest } from "@core/core/contracts/task.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
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
import { validateInput } from "@core/core/registry/schema-validator.js"
import type { OperationCard } from "@core/core/registry/types.js"
import { routePreferenceOrder } from "@core/core/routing/policy.js"
import type { RouteReasonCode } from "@core/core/routing/reason-codes.js"
import { buildBatchMutation, buildBatchQuery, extractRootFieldName } from "@core/gql/batch.js"
import { getLookupDocument, getMutationDocument } from "@core/gql/document-registry.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { applyInject, buildMutationVars } from "@core/gql/resolve.js"
import type { ResolutionCache } from "./resolution-cache.js"
import { buildCacheKey } from "./resolution-cache.js"

export type ExecutionDeps = {
  githubClient: GithubClient
  githubToken?: string | null
  cliRunner?: CliCommandRunner
  ghCliAvailable?: boolean
  ghAuthenticated?: boolean
  skipGhPreflight?: boolean
  reason?: RouteReasonCode
  resolutionCache?: ResolutionCache
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

function isRetryableCode(code: string): boolean {
  return code === errorCodes.RateLimit || code === errorCodes.Network || code === errorCodes.Server
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

export async function executeTasks(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope> {
  // 1-item: delegate to existing routing engine
  if (requests.length === 1) {
    const [req] = requests
    if (req === undefined) {
      // This should never happen, but TypeScript needs it
      return {
        status: "failed",
        results: [],
        meta: { route_used: "graphql", total: 0, succeeded: 0, failed: 0 },
      }
    }

    const result = await executeTask({ task: req.task, input: req.input }, deps)
    const step: ChainStepResult = result.ok
      ? { task: req.task, ok: true, data: result.data }
      : {
          task: req.task,
          ok: false,
          error: result.error || {
            code: errorCodes.Unknown,
            message: "Unknown error",
            retryable: false,
          },
        }
    return {
      status: result.ok ? "success" : "failed",
      results: [step],
      meta: {
        route_used: result.meta?.route_used ?? "graphql",
        total: 1,
        succeeded: result.ok ? 1 : 0,
        failed: result.ok ? 0 : 1,
      },
    }
  }

  // Pre-flight: validate all steps
  const preflightErrorByIndex = new Map<number, ChainStepResult>()
  const cards: NonNullable<ReturnType<typeof getOperationCard>>[] = []
  for (let i = 0; i < requests.length; i += 1) {
    const req = requests[i]
    if (req === undefined) continue
    try {
      const card = getOperationCard(req.task)
      if (!card) {
        throw new Error(`Invalid task: ${req.task}`)
      }

      const inputValidation = validateInput(card.input_schema, req.input)
      if (!inputValidation.ok) {
        const details = inputValidation.errors
          .map((e) => `${e.instancePath || "root"}: ${e.message}`)
          .join("; ")
        throw new Error(`Input validation failed: ${details}`)
      }

      if (!card.graphql) {
        throw new Error(`capability '${req.task}' has no GraphQL route and cannot be chained`)
      }

      // Validate that all resolution lookup vars are present in input
      if (card.graphql.resolution) {
        const { lookup } = card.graphql.resolution
        for (const [, inputField] of Object.entries(lookup.vars)) {
          if (req.input[inputField] === undefined) {
            throw new Error(
              `Resolution pre-flight failed for '${req.task}': lookup var '${inputField}' is missing from input`,
            )
          }
        }
      }

      cards.push(card)
    } catch (err) {
      preflightErrorByIndex.set(i, {
        task: req.task,
        ok: false,
        error: {
          code: mapErrorToCode(err),
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
        },
      })
    }
  }

  if (preflightErrorByIndex.size > 0) {
    return {
      status: "failed",
      results: requests.map(
        (req, i) =>
          preflightErrorByIndex.get(i) ?? {
            task: req.task,
            ok: false,
            error: { code: errorCodes.Unknown, message: "pre-flight failed", retryable: false },
          },
      ),
      meta: {
        route_used: "graphql",
        total: requests.length,
        succeeded: 0,
        failed: requests.length,
      },
    }
  }

  // Phase 1: batch resolution queries (steps with card.graphql.resolution)
  const lookupInputs: Array<{
    alias: string
    query: string
    variables: Record<string, unknown>
    stepIndex: number
  }> = []
  const lookupResults: Record<number, unknown> = {}

  function buildLookupVars(
    card: OperationCard,
    req: { input: Record<string, unknown> },
  ): Record<string, unknown> {
    const vars: Record<string, unknown> = {}
    if (card.graphql?.resolution) {
      for (const [lookupVar, inputField] of Object.entries(card.graphql.resolution.lookup.vars)) {
        vars[lookupVar] = req.input[inputField]
      }
    }
    return vars
  }

  for (let i = 0; i < requests.length; i += 1) {
    const card = cards[i]
    const req = requests[i]
    if (card === undefined || req === undefined) continue
    if (!card.graphql?.resolution) continue

    const lookupVars = buildLookupVars(card, req)

    // Check resolution cache before scheduling network call
    if (deps.resolutionCache) {
      const cacheKey = buildCacheKey(card.graphql.resolution.lookup.operationName, lookupVars)
      const cached = deps.resolutionCache.get(cacheKey)
      if (cached !== undefined) {
        lookupResults[i] = cached
        continue
      }
    }

    lookupInputs.push({
      alias: `step${i}`,
      query: getLookupDocument(card.graphql.resolution.lookup.operationName),
      variables: lookupVars,
      stepIndex: i,
    })
  }

  if (lookupInputs.length > 0) {
    try {
      const { document, variables } = buildBatchQuery(
        lookupInputs.map(({ alias, query, variables }) => ({ alias, query, variables })),
      )
      const rawResult = await deps.githubClient.query(document, variables)
      // Un-alias results: BatchChain result has keys like "step0", "step2", etc.
      // GitHub returns the root field value directly under the alias key — no extra wrapper.
      // Re-wrap it so applyInject path traversal (e.g. "repository.issue.id") works correctly.
      for (const { alias, query, stepIndex } of lookupInputs) {
        const rawValue = (rawResult as Record<string, unknown>)[alias]
        const rootFieldName = extractRootFieldName(query)
        const result = rootFieldName !== null ? { [rootFieldName]: rawValue } : rawValue
        lookupResults[stepIndex] = result

        // Populate resolution cache (skip undefined to avoid polluting cache)
        if (deps.resolutionCache && result !== undefined) {
          const card = cards[stepIndex]
          const req = requests[stepIndex]
          if (card?.graphql?.resolution && req) {
            const lookupVars = buildLookupVars(card, req)
            deps.resolutionCache.set(
              buildCacheKey(card.graphql.resolution.lookup.operationName, lookupVars),
              result,
            )
          }
        }
      }
    } catch (err) {
      // Phase 1 failure: mark all steps as failed
      const errorMsg = err instanceof Error ? err.message : String(err)
      const code = mapErrorToCode(err)
      return {
        status: "failed",
        results: requests.map((req) => ({
          task: req.task,
          ok: false,
          error: {
            code,
            message: `Phase 1 (resolution) failed: ${errorMsg}`,
            retryable: isRetryableCode(code),
          },
        })),
        meta: {
          route_used: "graphql",
          total: requests.length,
          succeeded: 0,
          failed: requests.length,
        },
      }
    }
  }

  // Phase 2: batch mutations
  const mutationInputs: Array<{
    alias: string
    mutation: string
    variables: Record<string, unknown>
    stepIndex: number
  }> = []
  const stepPreResults: Record<number, ChainStepResult> = {}

  for (let i = 0; i < requests.length; i += 1) {
    const card = cards[i]
    const req = requests[i]
    if (card === undefined || req === undefined) continue

    try {
      const resolved: Record<string, unknown> = {}
      if (card.graphql?.resolution && lookupResults[i] !== undefined) {
        for (const spec of card.graphql.resolution.inject) {
          Object.assign(resolved, applyInject(spec, lookupResults[i], req.input))
        }
      }

      if (card.graphql === undefined) {
        throw new Error("card.graphql is unexpectedly undefined")
      }

      const mutDoc = getMutationDocument(card.graphql.operationName)
      const mutVars = buildMutationVars(mutDoc, req.input, resolved)
      mutationInputs.push({
        alias: `step${i}`,
        mutation: mutDoc,
        variables: mutVars,
        stepIndex: i,
      })
    } catch (err) {
      stepPreResults[i] = {
        task: req.task,
        ok: false,
        error: {
          code: mapErrorToCode(err),
          message: err instanceof Error ? err.message : String(err),
          retryable: false,
        },
      }
    }
  }

  let rawMutResult: Record<string, unknown> = {}
  const stepErrors = new Map<string, string>()

  if (mutationInputs.length > 0) {
    try {
      const { document, variables } = buildBatchMutation(
        mutationInputs.map(({ alias, mutation, variables }) => ({ alias, mutation, variables })),
      )
      const rawResponse = await deps.githubClient.queryRaw<Record<string, unknown>>(
        document,
        variables,
      )

      // Map per-step errors from GraphQL error path
      if (rawResponse.errors?.length) {
        for (const err of rawResponse.errors) {
          const alias = err.path?.[0]
          if (typeof alias === "string" && alias.startsWith("step")) {
            stepErrors.set(alias, err.message)
          }
        }
        // If errors don't have per-step paths, mark all steps as failed
        if (stepErrors.size === 0) {
          for (const { alias } of mutationInputs) {
            stepErrors.set(alias, rawResponse.errors[0]?.message ?? "GraphQL batch error")
          }
        }
      }

      rawMutResult = rawResponse.data ?? {}
    } catch (err) {
      // Transport-level failure (network, HTTP error) — mark all pending steps as failed
      const code = mapErrorToCode(err)
      for (const { stepIndex } of mutationInputs) {
        const reqAtIndex = requests[stepIndex]
        if (reqAtIndex !== undefined) {
          stepPreResults[stepIndex] = {
            task: reqAtIndex.task,
            ok: false,
            error: {
              code,
              message: err instanceof Error ? err.message : String(err),
              retryable: isRetryableCode(code),
            },
          }
        }
      }
    }
  }

  // Assemble results
  const results: ChainStepResult[] = requests.map((req, stepIndex) => {
    const preResult = stepPreResults[stepIndex]
    if (preResult !== undefined) return preResult

    const mutInput = mutationInputs.find((m) => m.stepIndex === stepIndex)
    if (mutInput === undefined) {
      return {
        task: req.task,
        ok: false,
        error: { code: errorCodes.Unknown, message: "step skipped", retryable: false },
      }
    }

    // Check for per-step GraphQL errors
    const stepError = stepErrors.get(mutInput.alias)
    if (stepError !== undefined) {
      return {
        task: req.task,
        ok: false,
        error: {
          code: mapErrorToCode(stepError),
          message: stepError,
          retryable: false,
        },
      }
    }

    if (rawMutResult == null || typeof rawMutResult !== "object") {
      return {
        task: req.task,
        ok: false,
        error: {
          code: errorCodes.Unknown,
          message: `unexpected mutation response shape for alias ${mutInput.alias}`,
          retryable: false,
        },
      }
    }
    if (!(mutInput.alias in rawMutResult)) {
      return {
        task: req.task,
        ok: false,
        error: {
          code: errorCodes.Unknown,
          message: `missing mutation result for alias ${mutInput.alias}`,
          retryable: false,
        },
      }
    }
    const data = rawMutResult[mutInput.alias]
    return { task: req.task, ok: true, data }
  })

  const succeeded = results.filter((r) => r.ok).length
  const status: ChainStatus =
    succeeded === results.length ? "success" : succeeded === 0 ? "failed" : "partial"

  return {
    status,
    results,
    meta: {
      route_used: "graphql",
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
    },
  }
}
