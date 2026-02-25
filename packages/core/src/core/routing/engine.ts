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
import { logger } from "@core/core/telemetry/log.js"
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
    logger.error("execute.unsupported_task", { task: request.task })
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

  logger.debug("execute.start", { capability_id: request.task })
  const startMs = Date.now()

  const cliRunner = deps.cliRunner ?? defaultCliRunner

  const result = await execute({
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

  logger.info("execute.complete", {
    capability_id: request.task,
    ok: result.ok,
    route_used: result.meta?.route_used ?? null,
    duration_ms: Date.now() - startMs,
    error_code: result.error?.code ?? null,
  })

  return result
}

export async function executeTasks(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  deps: ExecutionDeps,
): Promise<ChainResultEnvelope> {
  logger.debug("execute_batch.start", { count: requests.length })
  const batchStart = Date.now()

  // 1-item: delegate to existing routing engine
  if (requests.length === 1) {
    const [req] = requests
    if (req === undefined) {
      // This should never happen, but TypeScript needs it
      logger.info("execute_batch.complete", {
        ok: false,
        status: "failed",
        total: 0,
        succeeded: 0,
        failed: 0,
        duration_ms: Date.now() - batchStart,
      })
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
    const succeeded1 = result.ok ? 1 : 0
    logger.info("execute_batch.complete", {
      ok: result.ok,
      status: result.ok ? "success" : "failed",
      total: 1,
      succeeded: succeeded1,
      failed: 1 - succeeded1,
      duration_ms: Date.now() - batchStart,
    })
    return {
      status: result.ok ? "success" : "failed",
      results: [step],
      meta: {
        route_used: result.meta?.route_used ?? "graphql",
        total: 1,
        succeeded: succeeded1,
        failed: 1 - succeeded1,
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

      if (!card.graphql && !card.cli) {
        throw new Error(
          `capability '${req.task}' has no supported route (graphql or cli) and cannot be chained`,
        )
      }

      // Validate that all resolution lookup vars are present in input (GQL-only)
      if (card.graphql?.resolution) {
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
    // Use "cli" only if every successfully-validated step would have gone through the CLI
    // adapter (i.e. no GQL cards passed pre-flight). Fall back to "graphql" when all steps
    // failed validation (cards is empty) because we cannot determine intent.
    const anyGqlCard = cards.some((c) => !!c.graphql)
    const preflightRouteUsed: RouteSource = !anyGqlCard && cards.length > 0 ? "cli" : "graphql"
    return {
      status: "failed",
      results: requests.map(
        (req, i) =>
          preflightErrorByIndex.get(i) ?? {
            task: req.task,
            ok: false,
            error: {
              code: errorCodes.Unknown,
              message: "pre-flight failed",
              retryable: false,
            },
          },
      ),
      meta: {
        route_used: preflightRouteUsed,
        total: requests.length,
        succeeded: 0,
        failed: requests.length,
      },
    }
  }

  // Kick off CLI-only steps concurrently alongside the GQL batch.
  // A step with no graphql config cannot participate in the GQL batch phases below,
  // so it is dispatched immediately via executeTask (CLI adapter path).
  // Pre-flight above already confirmed card.cli is present for these steps.
  //
  // Invariant: after pre-flight, cards has exactly one entry per request in order —
  // the early return above guarantees preflightErrorByIndex is empty, so every request
  // produced a card. Indexing cards[i] is safe for any valid request index i.
  const cliStepPromises = new Map<number, Promise<ResultEnvelope>>()
  for (let i = 0; i < requests.length; i += 1) {
    const card = cards[i]
    const req = requests[i]
    if (card === undefined || req === undefined) {
      throw new Error(`invariant violated: missing card or request at index ${i}`)
    }
    if (!card.graphql) {
      cliStepPromises.set(i, executeTask({ task: req.task, input: req.input }, deps))
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
        logger.debug("resolution.cache_hit", {
          step: i,
          operation: card.graphql.resolution.lookup.operationName,
          key: cacheKey,
        })
        continue
      }
    }

    logger.debug("resolution.lookup_scheduled", {
      step: i,
      operation: card.graphql.resolution.lookup.operationName,
    })
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
        lookupInputs.map(({ alias, query, variables }) => ({
          alias,
          query,
          variables,
        })),
      )
      logger.debug("query.batch_start", { count: lookupInputs.length })
      const rawResult = await deps.githubClient.query(document, variables)
      logger.debug("query.batch_complete", { count: lookupInputs.length })
      // Un-alias results: BatchChain result has keys like "step0", "step2", etc.
      // GitHub returns the root field value directly under the alias key — no extra wrapper.
      // Re-wrap it so applyInject path traversal (e.g. "repository.issue.id") works correctly.
      for (const { alias, query, stepIndex } of lookupInputs) {
        const rawValue = (rawResult as Record<string, unknown>)[alias]
        const rootFieldName = extractRootFieldName(query)
        const result = rootFieldName !== null ? { [rootFieldName]: rawValue } : rawValue
        lookupResults[stepIndex] = result
        logger.debug("resolution.step_resolved", { step: stepIndex, alias })

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
            logger.debug("resolution.cache_set", {
              step: stepIndex,
              operation: card.graphql.resolution.lookup.operationName,
            })
          }
        }
      }
    } catch (err) {
      // Phase 1 failure: GQL-dependent steps all fail. CLI steps that completed
      // concurrently may have succeeded — preserve their results for partial status.
      const cliPhase1Results = new Map<number, ResultEnvelope>()
      if (cliStepPromises.size > 0) {
        const cliEntries = Array.from(cliStepPromises.entries())
        const settled = await Promise.allSettled(cliEntries.map(([, p]) => p))
        for (let j = 0; j < cliEntries.length; j += 1) {
          const entry = cliEntries[j]
          const outcome = settled[j]
          if (entry === undefined || outcome === undefined) {
            throw new Error(`invariant violated: missing entry or outcome at drain index ${j}`)
          }
          const [i] = entry
          if (outcome.status === "fulfilled") {
            cliPhase1Results.set(i, outcome.value)
          } else {
            logger.warn("cli.step_drained_on_phase1_failure", {
              reason:
                outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
            })
            const req = requests[i]
            cliPhase1Results.set(i, {
              ok: false,
              error: {
                code: errorCodes.Unknown,
                message: String(outcome.reason),
                retryable: false,
              },
              meta: { capability_id: req?.task ?? "unknown", route_used: "cli" },
            })
          }
        }
      }
      const errorMsg = err instanceof Error ? err.message : String(err)
      const code = mapErrorToCode(err)
      logger.error("resolution.lookup_failed", {
        count: lookupInputs.length,
        error_code: code,
        message: errorMsg,
      })
      const phase1Error = {
        code,
        message: `Phase 1 (resolution) failed: ${errorMsg}`,
        retryable: isRetryableCode(code),
      }
      const phase1Results: ChainStepResult[] = requests.map((req, i) => {
        const cliResult = cliPhase1Results.get(i)
        if (cliResult !== undefined) {
          return cliResult.ok
            ? { task: req.task, ok: true, data: cliResult.data }
            : {
                task: req.task,
                ok: false,
                error:
                  cliResult.error ??
                  ({
                    code: errorCodes.Unknown,
                    message: "CLI step failed",
                    retryable: false,
                  } as const),
              }
        }
        return { task: req.task, ok: false, error: phase1Error }
      })
      const phase1Succeeded = phase1Results.filter((r) => r.ok).length
      const phase1Status: ChainStatus =
        phase1Succeeded === phase1Results.length
          ? "success"
          : phase1Succeeded === 0
            ? "failed"
            : "partial"
      return {
        status: phase1Status,
        results: phase1Results,
        meta: {
          // Phase 1 only runs when GQL resolution steps exist → always "graphql"
          route_used: "graphql",
          total: requests.length,
          succeeded: phase1Succeeded,
          failed: requests.length - phase1Succeeded,
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
    if (!card.graphql) continue // CLI-only steps are handled separately

    try {
      logger.debug("resolution.inject", { step: i, capability_id: req.task })
      const resolved: Record<string, unknown> = {}
      if (card.graphql.resolution && lookupResults[i] !== undefined) {
        for (const spec of card.graphql.resolution.inject) {
          Object.assign(resolved, applyInject(spec, lookupResults[i], req.input))
        }
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
        mutationInputs.map(({ alias, mutation, variables }) => ({
          alias,
          mutation,
          variables,
        })),
      )
      logger.debug("mutation.batch_start", { count: mutationInputs.length })
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
      logger.debug("mutation.batch_complete", { count: mutationInputs.length })
    } catch (err) {
      // Transport-level failure (network, HTTP error) — mark all pending steps as failed
      const code = mapErrorToCode(err)
      logger.error("mutation.batch_failed", { error_code: code })
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

  // Await CLI step results concurrently. Promise.allSettled prevents any single
  // rejection from propagating as an unhandled rejection — each failure is captured
  // as an error envelope instead.
  const cliResultsByIndex = new Map<number, ResultEnvelope>()
  if (cliStepPromises.size > 0) {
    const cliEntries = Array.from(cliStepPromises.entries())
    const settled = await Promise.allSettled(cliEntries.map(([, p]) => p))
    for (let j = 0; j < cliEntries.length; j += 1) {
      const entry = cliEntries[j]
      const outcome = settled[j]
      if (entry === undefined || outcome === undefined) {
        throw new Error(`invariant violated: missing entry or outcome at CLI collect index ${j}`)
      }
      const [i] = entry
      if (outcome.status === "fulfilled") {
        cliResultsByIndex.set(i, outcome.value)
      } else {
        // Defensive: executeTask returns ResultEnvelope rather than throwing, so this
        // branch only fires if executeTask has an unexpected internal error.
        const msg =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
        const req = requests[i]
        cliResultsByIndex.set(i, {
          ok: false,
          error: { code: errorCodes.Unknown, message: msg, retryable: false },
          meta: { capability_id: req?.task ?? "unknown", route_used: "cli" },
        })
      }
    }
  }

  // Assemble results
  const results: ChainStepResult[] = requests.map((req, stepIndex) => {
    const preResult = stepPreResults[stepIndex]
    if (preResult !== undefined) return preResult

    // CLI-only step
    const cliResult = cliResultsByIndex.get(stepIndex)
    if (cliResult !== undefined) {
      return cliResult.ok
        ? { task: req.task, ok: true, data: cliResult.data }
        : {
            task: req.task,
            ok: false,
            error: cliResult.error ?? {
              code: errorCodes.Unknown,
              message: "CLI step failed",
              retryable: false,
            },
          }
    }

    const mutInput = mutationInputs.find((m) => m.stepIndex === stepIndex)
    if (mutInput === undefined) {
      return {
        task: req.task,
        ok: false,
        error: {
          code: errorCodes.Unknown,
          message: "step skipped",
          retryable: false,
        },
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

  logger.info("execute_batch.complete", {
    ok: status !== "failed",
    status,
    total: results.length,
    succeeded,
    failed: results.length - succeeded,
    duration_ms: Date.now() - batchStart,
  })

  // "cli" only when every step was CLI-only. Mixed chains report "graphql" because
  // GraphQL is the primary coordination mechanism even when some steps used the CLI adapter.
  const routeUsed: RouteSource = cliStepPromises.size === requests.length ? "cli" : "graphql"

  return {
    status,
    results,
    meta: {
      route_used: routeUsed,
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
    },
  }
}
