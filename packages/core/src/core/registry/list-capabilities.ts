import { listOperationCards } from "./index.js"
import { extractOptionalInputs, extractRequiredInputs } from "./schema-utils.js"

export type CapabilityListItem = {
  capability_id: string
  description: string
  required_inputs: string[]
  optional_inputs: string[]
  optional_inputs_detail: Record<string, unknown>
}

export function listCapabilities(domain?: string): CapabilityListItem[] {
  let cards = listOperationCards()
  if (domain) {
    cards = cards.filter((card) => card.capability_id.split(".")[0] === domain)
  }
  return cards.map((card) => {
    const optionalDetail = extractOptionalInputs(card.input_schema)
    return {
      capability_id: card.capability_id,
      description: card.description,
      required_inputs: extractRequiredInputs(card.input_schema),
      optional_inputs: Object.keys(optionalDetail),
      optional_inputs_detail: optionalDetail,
    }
  })
}
