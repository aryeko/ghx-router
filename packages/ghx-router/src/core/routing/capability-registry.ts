export interface CapabilityEntry {
  task: string
  defaultRoute: "cli" | "rest" | "graphql"
  fallbackRoutes: Array<"cli" | "rest" | "graphql">
}

export const capabilityRegistry: CapabilityEntry[] = [
  {
    task: "repo.view",
    defaultRoute: "graphql",
    fallbackRoutes: []
  },
  {
    task: "issue.view",
    defaultRoute: "graphql",
    fallbackRoutes: []
  },
  {
    task: "issue.list",
    defaultRoute: "graphql",
    fallbackRoutes: []
  },
  {
    task: "pr.view",
    defaultRoute: "graphql",
    fallbackRoutes: []
  },
  {
    task: "pr.list",
    defaultRoute: "graphql",
    fallbackRoutes: []
  }
]
