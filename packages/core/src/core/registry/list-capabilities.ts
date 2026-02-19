import { listOperationCards } from "./index.js"

export type CapabilityListItem = {
  capability_id: string
  description: string
}

export function listCapabilities(): CapabilityListItem[] {
  return listOperationCards().map((card) => ({
    capability_id: card.capability_id,
    description: card.description,
  }))
}
