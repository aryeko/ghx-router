import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type RepoViewQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
}>

export type RepoViewQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    id: string
    name: string
    nameWithOwner: string
    isPrivate: boolean
    stargazerCount: number
    forkCount: number
    url: any
    defaultBranchRef?: { __typename?: "Ref"; name: string } | null
  } | null
}

export const RepoViewDocument = `
    query RepoView($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
    name
    nameWithOwner
    isPrivate
    stargazerCount
    forkCount
    url
    defaultBranchRef {
      name
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
    RepoView(
      variables: RepoViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<RepoViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<RepoViewQuery>({
            document: RepoViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "RepoView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
