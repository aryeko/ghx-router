import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueRelationsGetQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  issueNumber: Types.Scalars["Int"]["input"]
}>

export type IssueRelationsGetQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    issue?: {
      __typename?: "Issue"
      id: string
      number: number
      parent?: { __typename?: "Issue"; id: string; number: number } | null
      subIssues: {
        __typename?: "IssueConnection"
        nodes?: Array<{ __typename?: "Issue"; id: string; number: number } | null> | null
      }
      blockedBy: {
        __typename?: "IssueConnection"
        nodes?: Array<{ __typename?: "Issue"; id: string; number: number } | null> | null
      }
    } | null
  } | null
}

export const IssueRelationsGetDocument = `
    query IssueRelationsGet($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      id
      number
      parent {
        id
        number
      }
      subIssues(first: 50) {
        nodes {
          id
          number
        }
      }
      blockedBy(first: 50) {
        nodes {
          id
          number
        }
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
    IssueRelationsGet(
      variables: IssueRelationsGetQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueRelationsGetQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueRelationsGetQuery>({
            document: IssueRelationsGetDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueRelationsGet",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
