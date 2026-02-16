import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type IssueListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    issues: {
      __typename?: "IssueConnection"
      nodes?: Array<{
        __typename?: "Issue"
        id: string
        number: number
        title: string
        state: Types.IssueState
        url: any
      } | null> | null
      pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
    }
  } | null
}

export const IssueListDocument = `
    query IssueList($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    issues(
      first: $first
      after: $after
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      nodes {
        id
        number
        title
        state
        url
      }
      pageInfo {
        endCursor
        hasNextPage
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
    IssueList(
      variables: IssueListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueListQuery>({
            document: IssueListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
