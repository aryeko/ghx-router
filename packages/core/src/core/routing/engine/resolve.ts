import type { OperationCard } from "@core/core/registry/types.js"
import { logger } from "@core/core/telemetry/log.js"
import { buildBatchQuery, extractRootFieldName } from "@core/gql/batch.js"
import { getLookupDocument } from "@core/gql/document-registry.js"
import type { GithubClient } from "@core/gql/github-client.js"
import type { ResolutionCache } from "../resolution-cache.js"
import { buildCacheKey } from "../resolution-cache.js"
import type { ClassifiedStep } from "./types.js"

export type ResolutionResults = Record<number, unknown>

function buildLookupVars(
  card: OperationCard,
  input: Record<string, unknown>,
): Record<string, unknown> {
  const vars: Record<string, unknown> = {}
  if (card.graphql?.resolution) {
    for (const [lookupVar, inputField] of Object.entries(card.graphql.resolution.lookup.vars)) {
      vars[lookupVar] = input[inputField]
    }
  }
  return vars
}

export async function runResolutionPhase(
  steps: ClassifiedStep[],
  requests: Array<{ task: string; input: Record<string, unknown> }>,
  githubClient: GithubClient,
  resolutionCache?: ResolutionCache,
): Promise<ResolutionResults> {
  const lookupResults: ResolutionResults = {}

  const lookupInputs: Array<{
    alias: string
    query: string
    variables: Record<string, unknown>
    stepIndex: number
  }> = []

  for (const step of steps) {
    const { card, index } = step
    if (!card.graphql?.resolution) continue

    const req = requests[index]
    if (req === undefined) continue

    const lookupVars = buildLookupVars(card, req.input)

    // Check resolution cache before scheduling network call
    if (resolutionCache) {
      const cacheKey = buildCacheKey(card.graphql.resolution.lookup.operationName, lookupVars)
      const cached = resolutionCache.get(cacheKey)
      if (cached !== undefined) {
        lookupResults[index] = cached
        logger.debug("resolution.cache_hit", {
          step: index,
          operation: card.graphql.resolution.lookup.operationName,
          key: cacheKey,
        })
        continue
      }
    }

    logger.debug("resolution.lookup_scheduled", {
      step: index,
      operation: card.graphql.resolution.lookup.operationName,
    })
    lookupInputs.push({
      alias: `step${index}`,
      query: getLookupDocument(card.graphql.resolution.lookup.operationName),
      variables: lookupVars,
      stepIndex: index,
    })
  }

  if (lookupInputs.length === 0) {
    return lookupResults
  }

  const { document, variables } = buildBatchQuery(
    lookupInputs.map(({ alias, query, variables }) => ({
      alias,
      query,
      variables,
    })),
  )

  logger.debug("query.batch_start", { count: lookupInputs.length })
  // Throws on network/GQL error — caller handles it
  const rawResult = await githubClient.query(document, variables)
  logger.debug("query.batch_complete", { count: lookupInputs.length })

  // Un-alias results: BatchChain result has keys like "step0", "step2", etc.
  // GitHub returns the root field value directly under the alias key — no extra wrapper.
  // Re-wrap it so applyInject path traversal (e.g. "repository.issue.id") works correctly.
  for (const { alias, query, stepIndex } of lookupInputs) {
    const rawValue = (rawResult as Record<string, unknown>)[alias]
    if (rawValue === undefined) {
      logger.debug("resolution.step_missing", { step: stepIndex, alias })
      continue
    }
    const rootFieldName = extractRootFieldName(query)
    const result = rootFieldName !== null ? { [rootFieldName]: rawValue } : rawValue
    lookupResults[stepIndex] = result
    logger.debug("resolution.step_resolved", { step: stepIndex, alias })

    if (resolutionCache) {
      const step = steps.find((s) => s.index === stepIndex)
      const req = requests[stepIndex]
      if (step?.card.graphql?.resolution && req) {
        const lookupVars = buildLookupVars(step.card, req.input)
        resolutionCache.set(
          buildCacheKey(step.card.graphql.resolution.lookup.operationName, lookupVars),
          result,
        )
        logger.debug("resolution.cache_set", {
          step: stepIndex,
          operation: step.card.graphql.resolution.lookup.operationName,
        })
      }
    }
  }

  return lookupResults
}
