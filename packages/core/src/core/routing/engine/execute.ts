import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { logger } from "@core/core/telemetry/log.js"
import { buildBatchMutation, buildBatchQuery } from "@core/gql/batch.js"
import { getDocument } from "@core/gql/document-registry.js"
import { applyInject, buildOperationVars } from "@core/gql/resolve.js"
import type { ResolutionResults } from "./resolve.js"
import type { ClassifiedStep, ExecutionDeps } from "./types.js"

export type GqlExecutePhaseResults = {
  mutationRawResult: Record<string, unknown>
  queryRawResult: Record<string, unknown>
  stepErrors: Map<string, string>
}

export async function runGqlExecutePhase(
  steps: ClassifiedStep[],
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  lookupResults: ResolutionResults,
  deps: ExecutionDeps,
): Promise<GqlExecutePhaseResults> {
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

  const stepErrors = new Map<string, string>()
  const stepPreErrors = new Map<number, string>()

  for (const step of steps) {
    const { card, index, route } = step
    const req = requests[index]
    if (req === undefined) continue

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

  for (const [index, msg] of stepPreErrors) {
    stepErrors.set(`step${index}`, msg)
  }

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
              const attributedAliases = new Set<string>()
              for (const err of rawResponse.errors) {
                const alias = err.path?.[0]
                if (typeof alias === "string" && alias.startsWith("step")) {
                  stepErrors.set(alias, err.message)
                  attributedAliases.add(alias)
                }
              }
              if (attributedAliases.size === 0) {
                for (const { alias } of mutationInputs) {
                  if (!stepErrors.has(alias)) {
                    stepErrors.set(alias, rawResponse.errors[0]?.message ?? "GraphQL batch error")
                  }
                }
              }
            }

            mutationRawResult = rawResponse.data ?? {}
            logger.debug("mutation.batch_complete", { count: mutationInputs.length })
          } catch (err) {
            const code = mapErrorToCode(err)
            logger.error("mutation.batch_failed", { error_code: code })
            for (const { alias } of mutationInputs) {
              stepErrors.set(alias, err instanceof Error ? err.message : String(err))
            }
          }
        })()
      : Promise.resolve()

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
            const code = mapErrorToCode(err)
            logger.error("query.batch_failed", { error_code: code })
            for (const { alias } of queryInputs) {
              stepErrors.set(alias, err instanceof Error ? err.message : String(err))
            }
          }
        })()
      : Promise.resolve()

  // Mutation and query aliases cannot collide: each step is classified as either a
  // gql-mutation or a gql-query (never both), so mutationInputs and queryInputs hold
  // disjoint sets of `step<index>` aliases. Concurrent writes to stepErrors are safe.
  await Promise.allSettled([mutationPromise, queryPromise])

  return {
    mutationRawResult,
    queryRawResult,
    stepErrors,
  }
}
