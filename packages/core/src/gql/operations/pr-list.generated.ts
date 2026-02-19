import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"
import { PrCoreFieldsFragmentDoc } from "./fragments/pr-core-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type PrListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequests: {
      __typename?: "PullRequestConnection"
      nodes?: Array<{
        __typename?: "PullRequest"
        id: string
        number: number
        title: string
        state: Types.PullRequestState
        url: any
      } | null> | null
      pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
    }
  } | null
}

export const PrListDocument = `
    query PrList($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(
      first: $first
      after: $after
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      nodes {
        ...PrCoreFields
      }
      pageInfo {
        ...PageInfoFields
      }
    }
  }
}
    ${PrCoreFieldsFragmentDoc}
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
    PrList(
      variables: PrListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrListQuery>({
            document: PrListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
