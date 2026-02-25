import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type RepoIssueTypesListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type RepoIssueTypesListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    issueTypes?: {
      __typename?: "IssueTypeConnection"
      nodes?: Array<{
        __typename?: "IssueType"
        id: string
        name: string
        color: Types.IssueTypeColor
        isEnabled: boolean
      } | null> | null
      pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
    } | null
  } | null
}

export const RepoIssueTypesListDocument = `
    query RepoIssueTypesList($owner: String!, $name: String!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    issueTypes(first: $first, after: $after) {
      nodes {
        id
        name
        color
        isEnabled
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
    RepoIssueTypesList(
      variables: RepoIssueTypesListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<RepoIssueTypesListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<RepoIssueTypesListQuery>({
            document: RepoIssueTypesListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "RepoIssueTypesList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
