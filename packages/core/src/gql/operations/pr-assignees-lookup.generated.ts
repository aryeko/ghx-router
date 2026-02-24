import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrAssigneesLookupQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
}>

export type PrAssigneesLookupQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: {
      __typename?: "PullRequest"
      id: string
      assignees: {
        __typename?: "UserConnection"
        nodes?: Array<{ __typename?: "User"; id: string; login: string } | null> | null
      }
    } | null
    assignableUsers: {
      __typename?: "UserConnection"
      nodes?: Array<{ __typename?: "User"; id: string; login: string } | null> | null
    }
  } | null
}

export const PrAssigneesLookupDocument = `
    query PrAssigneesLookup($owner: String!, $name: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      id
      assignees(first: 100) {
        nodes {
          id
          login
        }
      }
    }
    assignableUsers(first: 100) {
      nodes {
        id
        login
      }
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
    PrAssigneesLookup(
      variables: PrAssigneesLookupQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrAssigneesLookupQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrAssigneesLookupQuery>({
            document: PrAssigneesLookupDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrAssigneesLookup",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
