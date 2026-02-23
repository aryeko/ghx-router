import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueMilestoneLookupByNumberQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  issueNumber: Types.Scalars["Int"]["input"]
  milestoneNumber: Types.Scalars["Int"]["input"]
}>

export type IssueMilestoneLookupByNumberQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    issue?: { __typename?: "Issue"; id: string } | null
    milestone?: { __typename?: "Milestone"; id: string } | null
  } | null
}

export const IssueMilestoneLookupByNumberDocument = `
    query IssueMilestoneLookupByNumber($owner: String!, $name: String!, $issueNumber: Int!, $milestoneNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      id
    }
    milestone(number: $milestoneNumber) {
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
    IssueMilestoneLookupByNumber(
      variables: IssueMilestoneLookupByNumberQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueMilestoneLookupByNumberQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueMilestoneLookupByNumberQuery>({
            document: IssueMilestoneLookupByNumberDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueMilestoneLookupByNumber",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
