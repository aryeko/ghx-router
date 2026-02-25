import type { ResultEnvelope } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { logger } from "@core/core/telemetry/log.js"
import { buildBatchMutation, buildBatchQuery } from "@core/gql/batch.js"
import { getDocument } from "@core/gql/document-registry.js"
import { applyInject, buildOperationVars } from "@core/gql/resolve.js"
import type { ResolutionResults } from "./resolve.js"
import type { ClassifiedStep, ExecutionDeps } from "./types.js"

export type ExecutePhaseResults = {
  mutationRawResult: Record<string, unknown>
  queryRawResult: Record<string, unknown>
  stepErrors: Map<string, string>
  cliResults: Map<number, ResultEnvelope>
}

export async function runExecutePhase(
  steps: ClassifiedStep[],
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  lookupResults: ResolutionResults,
  deps: ExecutionDeps,
  executeCliStep: (task: string, input: Record<string, unknown>) => Promise<ResultEnvelope>,
  // Pre-started CLI promises from batch.ts (started concurrently with Phase 1)
  preStartedCliPromises?: Array<Promise<[number, ResultEnvelope]>>,
): Promise<ExecutePhaseResults> {
  const mutationInputs: Array<{
    alias: string
    mutation: string
    variables: Record<string, unknown>
    stepIndex: number
  }> = []

  const queryInputs: Array<{
    alias: string
    query: string
    variables: Record<string, unknown>
    stepIndex: number
  }> = []

  const cliResults = new Map<number, ResultEnvelope>()
  const stepErrors = new Map<string, string>()

  // Classify each step and build per-batch inputs
  const stepPreErrors = new Map<number, string>()

  for (const step of steps) {
    const { card, index, route } = step
    const req = requests[index]
    if (req === undefined) continue

    if (route === "cli") {
      // CLI steps are handled separately (either via preStartedCliPromises or dispatched below)
      continue
    }

    try {
      logger.debug("resolution.inject", { step: index, capability_id: req.task })
      const resolved: Record<string, unknown> = {}
      if (card.graphql?.resolution && lookupResults[index] !== undefined) {
        for (const spec of card.graphql.resolution.inject) {
          Object.assign(resolved, applyInject(spec, lookupResults[index], req.input))
        }
      }

      if (!card.graphql) {
        throw new Error(`Step ${index}: card has no graphql config for route '${route}'`)
      }
      const doc = getDocument(card.graphql.operationName)
      const vars = buildOperationVars(doc, req.input, resolved)

      if (route === "gql-mutation") {
        mutationInputs.push({
          alias: `step${index}`,
          mutation: doc,
          variables: vars,
          stepIndex: index,
        })
      } else {
        // gql-query
        queryInputs.push({
          alias: `step${index}`,
          query: doc,
          variables: vars,
          stepIndex: index,
        })
      }
    } catch (err) {
      stepPreErrors.set(index, err instanceof Error ? err.message : String(err))
    }
  }

  // Mark pre-errors in stepErrors using step alias format so callers can correlate
  for (const [index, msg] of stepPreErrors) {
    stepErrors.set(`step${index}`, msg)
  }

  // Use pre-started CLI promises if provided, otherwise dispatch now
  const cliSteps = steps.filter((s) => s.route === "cli")
  const cliPromises: Array<Promise<[number, ResultEnvelope]>> =
    preStartedCliPromises !== undefined
      ? preStartedCliPromises
      : cliSteps.map((step) => {
          const req = requests[step.index]
          if (req === undefined) {
            return Promise.resolve<[number, ResultEnvelope]>([
              step.index,
              {
                ok: false,
                error: { code: errorCodes.Unknown, message: "missing request", retryable: false },
                meta: { capability_id: step.card.capability_id, route_used: "cli" },
              },
            ])
          }
          return executeCliStep(req.task, req.input).then((result): [number, ResultEnvelope] => [
            step.index,
            result,
          ])
        })

  // Execute mutations batch
  let mutationRawResult: Record<string, unknown> = {}

  const mutationPromise =
    mutationInputs.length > 0
      ? (async () => {
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

            mutationRawResult = rawResponse.data ?? {}
            logger.debug("mutation.batch_complete", { count: mutationInputs.length })
          } catch (err) {
            // Transport-level failure — mark all mutation steps as failed
            const code = mapErrorToCode(err)
            logger.error("mutation.batch_failed", { error_code: code })
            for (const { alias } of mutationInputs) {
              stepErrors.set(alias, err instanceof Error ? err.message : String(err))
            }
          }
        })()
      : Promise.resolve()

  // Execute queries batch
  let queryRawResult: Record<string, unknown> = {}

  const queryPromise =
    queryInputs.length > 0
      ? (async () => {
          try {
            const { document, variables } = buildBatchQuery(
              queryInputs.map(({ alias, query, variables }) => ({
                alias,
                query,
                variables,
              })),
            )
            logger.debug("query.batch_start", { count: queryInputs.length })
            const rawResult = await deps.githubClient.query<Record<string, unknown>>(
              document,
              variables,
            )
            queryRawResult = rawResult
            logger.debug("query.batch_complete", { count: queryInputs.length })
          } catch (err) {
            // Transport-level failure — mark all query steps as failed
            const code = mapErrorToCode(err)
            logger.error("query.batch_failed", { error_code: code })
            for (const { alias } of queryInputs) {
              stepErrors.set(alias, err instanceof Error ? err.message : String(err))
            }
          }
        })()
      : Promise.resolve()

  // Run mutations, queries, and CLI steps in parallel
  await Promise.allSettled([mutationPromise, queryPromise, ...cliPromises]).then((outcomes) => {
    // CLI outcomes start after the two GQL promises
    const cliOutcomes = outcomes.slice(2)
    for (let j = 0; j < cliSteps.length; j += 1) {
      const step = cliSteps[j]
      const outcome = cliOutcomes[j]
      if (step === undefined || outcome === undefined) continue

      if (outcome.status === "fulfilled") {
        const [, result] = outcome.value as [number, ResultEnvelope]
        cliResults.set(step.index, result)
      } else {
        const msg =
          outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason)
        const req = requests[step.index]
        cliResults.set(step.index, {
          ok: false,
          error: { code: errorCodes.Unknown, message: msg, retryable: false },
          meta: { capability_id: req?.task ?? "unknown", route_used: "cli" },
        })
      }
    }
  })

  return {
    mutationRawResult,
    queryRawResult,
    stepErrors,
    cliResults,
  }
}
