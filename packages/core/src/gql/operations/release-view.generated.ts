import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ReleaseViewQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  tagName: Types.Scalars["String"]["input"]
}>

export type ReleaseViewQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    release?: {
      __typename?: "Release"
      databaseId?: number | null
      tagName: string
      name?: string | null
      isDraft: boolean
      isPrerelease: boolean
      url: any
      createdAt: any
      publishedAt?: any | null
      tagCommit?: { __typename?: "Commit"; oid: any } | null
    } | null
  } | null
}

export const ReleaseViewDocument = `
    query ReleaseView($owner: String!, $name: String!, $tagName: String!) {
  repository(owner: $owner, name: $name) {
    release(tagName: $tagName) {
      databaseId
      tagName
      name
      isDraft
      isPrerelease
      url
      tagCommit {
        oid
      }
      createdAt
      publishedAt
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
    ReleaseView(
      variables: ReleaseViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ReleaseViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ReleaseViewQuery>({
            document: ReleaseViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ReleaseView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
