import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueNodeIdLookupQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  issueNumber: Types.Scalars["Int"]["input"]
}>

export type IssueNodeIdLookupQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    issue?: { __typename?: "Issue"; id: string } | null
  } | null
}

export const IssueNodeIdLookupDocument = `
    query IssueNodeIdLookup($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
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
    IssueNodeIdLookup(
      variables: IssueNodeIdLookupQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueNodeIdLookupQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueNodeIdLookupQuery>({
            document: IssueNodeIdLookupDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueNodeIdLookup",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
