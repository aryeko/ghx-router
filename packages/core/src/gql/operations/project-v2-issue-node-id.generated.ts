import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ProjectV2IssueNodeIdQueryVariables = Types.Exact<{
  url: Types.Scalars["URI"]["input"]
}>

export type ProjectV2IssueNodeIdQuery = {
  __typename?: "Query"
  resource?:
    | { __typename?: "Bot" }
    | { __typename?: "CheckRun" }
    | { __typename?: "ClosedEvent" }
    | { __typename?: "Commit" }
    | { __typename?: "ConvertToDraftEvent" }
    | { __typename?: "CrossReferencedEvent" }
    | { __typename?: "Gist" }
    | { __typename?: "Issue"; id: string }
    | { __typename?: "Mannequin" }
    | { __typename?: "MergedEvent" }
    | { __typename?: "Milestone" }
    | { __typename?: "Organization" }
    | { __typename?: "PullRequest" }
    | { __typename?: "PullRequestCommit" }
    | { __typename?: "ReadyForReviewEvent" }
    | { __typename?: "Release" }
    | { __typename?: "Repository" }
    | { __typename?: "RepositoryTopic" }
    | { __typename?: "ReviewDismissedEvent" }
    | { __typename?: "User" }
    | { __typename?: "Workflow" }
    | { __typename?: "WorkflowRun" }
    | { __typename?: "WorkflowRunFile" }
    | null
}

export const ProjectV2IssueNodeIdDocument = `
    query ProjectV2IssueNodeId($url: URI!) {
  resource(url: $url) {
    ... on Issue {
      id
    }
  }
}
    `

export type SdkFunctionWrapper = <T>(
  action: (requestHeaders?: Record<string, string>) => Promise<T>,
  operationName: string,
  operationType?: string,
  variables?: any,
) => Promise<T>

const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) =>
  action()

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    ProjectV2IssueNodeId(
      variables: ProjectV2IssueNodeIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2IssueNodeIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2IssueNodeIdQuery>({
            document: ProjectV2IssueNodeIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2IssueNodeId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
