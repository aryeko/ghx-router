import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrNodeIdQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
}>

export type PrNodeIdQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: { __typename?: "PullRequest"; id: string } | null
  } | null
}

export const PrNodeIdDocument = `
    query PrNodeId($owner: String!, $name: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
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
    PrNodeId(
      variables: PrNodeIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrNodeIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrNodeIdQuery>({
            document: PrNodeIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrNodeId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
