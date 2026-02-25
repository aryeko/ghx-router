import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ReleaseListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type ReleaseListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    releases: {
      __typename?: "ReleaseConnection"
      nodes?: Array<{
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
      } | null> | null
      pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
    }
  } | null
}

export const ReleaseListDocument = `
    query ReleaseList($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    releases(
      first: $first
      after: $after
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      nodes {
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
      pageInfo {
        ...PageInfoFields
      }
    }
  }
}
    ${PageInfoFieldsFragmentDoc}`

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
    ReleaseList(
      variables: ReleaseListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ReleaseListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ReleaseListQuery>({
            document: ReleaseListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ReleaseList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
