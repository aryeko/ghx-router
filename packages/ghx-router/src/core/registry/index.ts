import { operationCards } from "./cards.js"
import type { OperationCard } from "./types.js"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function validateOperationCard(card: unknown): { ok: true } | { ok: false; error: string } {
  if (!isObject(card)) {
    return { ok: false, error: "Operation card must be an object" }
  }

  const requiredStringKeys = ["capability_id", "version", "description"]
  for (const key of requiredStringKeys) {
    if (typeof card[key] !== "string" || card[key].length === 0) {
      return { ok: false, error: `Missing required string field '${key}'` }
    }
  }

  if (!isObject(card.input_schema) || !isObject(card.output_schema)) {
    return { ok: false, error: "Card must include object input_schema and output_schema" }
  }

  if (!isObject(card.routing)) {
    return { ok: false, error: "Card must include routing object" }
  }

  const preferred = card.routing.preferred
  if (preferred !== "cli" && preferred !== "rest" && preferred !== "graphql") {
    return { ok: false, error: "routing.preferred must be one of cli|rest|graphql" }
  }

  if (!Array.isArray(card.routing.fallbacks)) {
    return { ok: false, error: "routing.fallbacks must be an array" }
  }

  return { ok: true }
}

for (const card of operationCards) {
  const validation = validateOperationCard(card)
  if (!validation.ok) {
    throw new Error(`Invalid operation card '${card.capability_id}': ${validation.error}`)
  }
}

export function listOperationCards(): OperationCard[] {
  return [...operationCards]
}

export function getOperationCard(capabilityId: string): OperationCard | undefined {
  return operationCards.find((card) => card.capability_id === capabilityId)
}
