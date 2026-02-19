import { getOperationCard } from "./index.js"
import { extractOutputFields, extractRequiredInputs } from "./schema-utils.js"

export type CapabilityExplanation = {
  capability_id: string
  purpose: string
  required_inputs: string[]
  preferred_route: "cli" | "graphql" | "rest"
  fallback_routes: Array<"cli" | "graphql" | "rest">
  output_fields: string[]
}

export function explainCapability(capabilityId: string): CapabilityExplanation {
  const card = getOperationCard(capabilityId)
  if (!card) {
    throw new Error(`Unknown capability: ${capabilityId}`)
  }

  return {
    capability_id: card.capability_id,
    purpose: card.description,
    required_inputs: extractRequiredInputs(card.input_schema),
    preferred_route: card.routing.preferred,
    fallback_routes: [...card.routing.fallbacks],
    output_fields: extractOutputFields(card.output_schema),
  }
}
