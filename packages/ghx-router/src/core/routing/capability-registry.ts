import { listOperationCards } from "../registry/index.js"

export interface CapabilityEntry {
  task: string
  defaultRoute: "cli" | "rest" | "graphql"
  fallbackRoutes: Array<"cli" | "rest" | "graphql">
}

export const capabilityRegistry: CapabilityEntry[] = listOperationCards().map((card) => ({
  task: card.capability_id,
  defaultRoute: card.routing.preferred,
  fallbackRoutes: [...card.routing.fallbacks]
}))
