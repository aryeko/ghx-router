import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueAssigneesLookupByNumberQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  issueNumber: Types.Scalars["Int"]["input"]
}>

export type IssueAssigneesLookupByNumberQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    issue?: { __typename?: "Issue"; id: string } | null
    assignableUsers: {
      __typename?: "UserConnection"
      pageInfo: { __typename?: "PageInfo"; hasNextPage: boolean; endCursor?: string | null }
      nodes?: Array<{ __typename?: "User"; id: string; login: string } | null> | null
    }
  } | null
}

export const IssueAssigneesLookupByNumberDocument = `
    query IssueAssigneesLookupByNumber($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      id
    }
    assignableUsers(first: 100) {
      pageInfo {
        hasNextPage
        endCursor
      }
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
    IssueAssigneesLookupByNumber(
      variables: IssueAssigneesLookupByNumberQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueAssigneesLookupByNumberQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueAssigneesLookupByNumberQuery>({
            document: IssueAssigneesLookupByNumberDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueAssigneesLookupByNumber",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
