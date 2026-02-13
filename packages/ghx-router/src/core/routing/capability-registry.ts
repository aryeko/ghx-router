export interface CapabilityEntry {
  task: string
  defaultRoute: "cli" | "rest" | "graphql"
  fallbackRoutes: Array<"cli" | "rest" | "graphql">
}

export const capabilityRegistry: CapabilityEntry[] = [
  {
    task: "repo.view",
    defaultRoute: "graphql",
    fallbackRoutes: ["cli", "rest"]
  },
  {
    task: "issue.view",
    defaultRoute: "graphql",
    fallbackRoutes: ["cli", "rest"]
  },
  {
    task: "issue.list",
    defaultRoute: "graphql",
    fallbackRoutes: ["cli", "rest"]
  },
  {
    task: "pr.view",
    defaultRoute: "graphql",
    fallbackRoutes: ["cli", "rest"]
  },
  {
    task: "pr.list",
    defaultRoute: "graphql",
    fallbackRoutes: ["cli", "rest"]
  }
]
