import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueLabelsLookupByNumberQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  issueNumber: Types.Scalars["Int"]["input"]
}>

export type IssueLabelsLookupByNumberQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    issue?: { __typename?: "Issue"; id: string } | null
    labels?: {
      __typename?: "LabelConnection"
      pageInfo: { __typename?: "PageInfo"; hasNextPage: boolean; endCursor?: string | null }
      nodes?: Array<{ __typename?: "Label"; id: string; name: string } | null> | null
    } | null
  } | null
}

export const IssueLabelsLookupByNumberDocument = `
    query IssueLabelsLookupByNumber($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      id
    }
    labels(first: 100) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
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
    IssueLabelsLookupByNumber(
      variables: IssueLabelsLookupByNumberQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueLabelsLookupByNumberQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueLabelsLookupByNumberQuery>({
            document: IssueLabelsLookupByNumberDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueLabelsLookupByNumber",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
