import type { OperationCard } from "./types.js"

const DEFAULT_FALLBACKS = ["cli", "rest"] as const

function baseCard(
  capabilityId: string,
  description: string,
  operationName: string,
  documentPath: string
): OperationCard {
  return {
    capability_id: capabilityId,
    version: "1.0.0",
    description,
    input_schema: {
      type: "object"
    },
    output_schema: {
      type: "object"
    },
    routing: {
      preferred: "graphql",
      fallbacks: [...DEFAULT_FALLBACKS],
      notes: ["Prefer GraphQL for typed shape, fallback to CLI or REST when unavailable."]
    },
    graphql: {
      operationName,
      documentPath
    },
    cli: {
      command: capabilityId.replace(".", " ")
    }
  }
}

export const operationCards: OperationCard[] = [
  baseCard("repo.view", "Fetch repository metadata.", "RepoView", "src/gql/operations/repo-view.graphql"),
  baseCard("issue.view", "Fetch one issue by number.", "IssueView", "src/gql/operations/issue-view.graphql"),
  baseCard("issue.list", "List repository issues.", "IssueList", "src/gql/operations/issue-list.graphql"),
  baseCard("pr.view", "Fetch one pull request by number.", "PrView", "src/gql/operations/pr-view.graphql"),
  baseCard("pr.list", "List repository pull requests.", "PrList", "src/gql/operations/pr-list.graphql")
]
