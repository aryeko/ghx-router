import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type RepoLabelsListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type RepoLabelsListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    labels?: {
      __typename?: "LabelConnection"
      nodes?: Array<{
        __typename?: "Label"
        id: string
        name: string
        description?: string | null
        color: string
        isDefault: boolean
      } | null> | null
      pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
    } | null
  } | null
}

export const RepoLabelsListDocument = `
    query RepoLabelsList($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    labels(
      first: $first
      after: $after
      orderBy: {field: CREATED_AT, direction: DESC}
    ) {
      nodes {
        id
        name
        description
        color
        isDefault
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
    RepoLabelsList(
      variables: RepoLabelsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<RepoLabelsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<RepoLabelsListQuery>({
            document: RepoLabelsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "RepoLabelsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
