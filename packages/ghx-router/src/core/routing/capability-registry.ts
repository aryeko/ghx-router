export interface CapabilityEntry {
  task: string
  defaultRoute: "cli" | "rest" | "graphql"
  fallbackRoutes: Array<"cli" | "rest" | "graphql">
}

export const capabilityRegistry: CapabilityEntry[] = []
