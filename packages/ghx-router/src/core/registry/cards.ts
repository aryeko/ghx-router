import type { OperationCard } from "./types.js"

const DEFAULT_FALLBACKS = ["cli"] as const

function baseCard(
  capabilityId: string,
  description: string,
  operationName: string,
  documentPath: string,
  required: string[],
  outputSchema: Record<string, unknown>
): OperationCard {
  return {
    capability_id: capabilityId,
    version: "1.0.0",
    description,
    input_schema: {
      type: "object",
      required
    },
    output_schema: {
      ...outputSchema
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
  baseCard(
    "repo.view",
    "Fetch repository metadata.",
    "RepoView",
    "src/gql/operations/repo-view.graphql",
    ["owner", "name"],
    {
      type: "object",
      required: ["id", "name", "nameWithOwner", "isPrivate", "url", "defaultBranch"],
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        nameWithOwner: { type: "string" },
        isPrivate: { type: "boolean" },
        stargazerCount: { type: "number" },
        forkCount: { type: "number" },
        url: { type: "string" },
        defaultBranch: { type: "string" }
      }
    }
  ),
  baseCard(
    "issue.view",
    "Fetch one issue by number.",
    "IssueView",
    "src/gql/operations/issue-view.graphql",
    ["owner", "name", "issueNumber"],
    {
      type: "object",
      required: ["id", "number", "title", "state", "url"],
      properties: {
        id: { type: "string" },
        number: { type: "number" },
        title: { type: "string" },
        state: { type: "string" },
        url: { type: "string" }
      }
    }
  ),
  baseCard(
    "issue.list",
    "List repository issues.",
    "IssueList",
    "src/gql/operations/issue-list.graphql",
    ["owner", "name"],
    {
      type: "object",
      required: ["items", "pageInfo"],
      properties: {
        items: { type: "array" },
        pageInfo: { type: "object" }
      }
    }
  ),
  baseCard(
    "issue.comments.list",
    "List comments for one issue.",
    "IssueCommentsList",
    "src/gql/operations/issue-comments-list.graphql",
    ["owner", "name", "issueNumber"],
    {
      type: "object",
      required: ["items", "pageInfo"],
      properties: {
        items: { type: "array" },
        pageInfo: { type: "object" }
      }
    }
  ),
  baseCard(
    "pr.view",
    "Fetch one pull request by number.",
    "PrView",
    "src/gql/operations/pr-view.graphql",
    ["owner", "name", "prNumber"],
    {
      type: "object",
      required: ["id", "number", "title", "state", "url"],
      properties: {
        id: { type: "string" },
        number: { type: "number" },
        title: { type: "string" },
        state: { type: "string" },
        url: { type: "string" }
      }
    }
  ),
  baseCard(
    "pr.list",
    "List repository pull requests.",
    "PrList",
    "src/gql/operations/pr-list.graphql",
    ["owner", "name"],
    {
      type: "object",
      required: ["items", "pageInfo"],
      properties: {
        items: { type: "array" },
        pageInfo: { type: "object" }
      }
    }
  )
]
