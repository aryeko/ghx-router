import type { ChainStepResult, RouteSource } from "@core/core/contracts/envelope.js"
import { errorCodes } from "@core/core/errors/codes.js"
import { mapErrorToCode } from "@core/core/errors/map-error.js"
import { getOperationCard } from "@core/core/registry/index.js"
import { validateInput } from "@core/core/registry/schema-validator.js"
import type { OperationCard } from "@core/core/registry/types.js"
import type { ClassifiedStep } from "./types.js"

export type PreflightSuccess = {
  ok: true
  steps: ClassifiedStep[]
  cards: OperationCard[]
}

export type PreflightFailure = {
  ok: false
  results: ChainStepResult[]
  routeUsed: RouteSource
}

export function runPreflight(
  requests: Array<{ task: string; input: Record<string, unknown> }>,
): PreflightSuccess | PreflightFailure {
  const preflightErrorByIndex = new Map<number, ChainStepResult>()
  const cards: OperationCard[] = []
  const cardIsCliOnly: boolean[] = []

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
      cardIsCliOnly.push(!card.graphql)
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
    const results: ChainStepResult[] = requests.map(
      (req, i) =>
        preflightErrorByIndex.get(i) ?? {
          task: req?.task ?? "unknown",
          ok: false,
          error: {
            code: errorCodes.Unknown,
            message: "pre-flight failed",
            retryable: false,
          },
        },
    )
    // If all cards that passed preflight are CLI-only, report cli route_used
    const anyGqlCard = cardIsCliOnly.some((isCliOnly) => !isCliOnly)
    const routeUsed: RouteSource = !anyGqlCard && cards.length > 0 ? "cli" : "graphql"
    return { ok: false, results, routeUsed }
  }

  const steps: ClassifiedStep[] = []
  let cardIndex = 0
  for (let i = 0; i < requests.length; i += 1) {
    const req = requests[i]
    const card = cards[cardIndex]
    if (req === undefined || card === undefined) continue
    cardIndex += 1

    let route: ClassifiedStep["route"]
    if (!card.graphql) {
      route = "cli"
    } else if (card.graphql.operationType === "query") {
      route = "gql-query"
    } else {
      route = "gql-mutation"
    }

    steps.push({ route, card, index: i, request: req })
  }

  return { ok: true, steps, cards }
}
