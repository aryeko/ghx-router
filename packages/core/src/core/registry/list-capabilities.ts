import { listOperationCards } from "./index.js"
import { extractRequiredInputs } from "./schema-utils.js"

export type CapabilityListItem = {
  capability_id: string
  description: string
  required_inputs: string[]
}

export function listCapabilities(domain?: string): CapabilityListItem[] {
  let cards = listOperationCards()
  if (domain) {
    cards = cards.filter((card) => card.capability_id.split(".")[0] === domain)
  }
  return cards.map((card) => ({
    capability_id: card.capability_id,
    description: card.description,
    required_inputs: extractRequiredInputs(card.input_schema),
  }))
}
