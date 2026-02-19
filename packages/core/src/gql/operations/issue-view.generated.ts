import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"
import { IssueCoreFieldsFragmentDoc } from "./fragments/issue-core-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueViewQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  issueNumber: Types.Scalars["Int"]["input"]
}>

export type IssueViewQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    issue?: {
      __typename?: "Issue"
      body: string
      id: string
      number: number
      title: string
      state: Types.IssueState
      url: any
      labels?: {
        __typename?: "LabelConnection"
        nodes?: Array<{ __typename?: "Label"; name: string } | null> | null
      } | null
    } | null
  } | null
}

export const IssueViewDocument = `
    query IssueView($owner: String!, $name: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      ...IssueCoreFields
      body
      labels(first: 20) {
        nodes {
          name
        }
      }
    }
  }
}
    ${IssueCoreFieldsFragmentDoc}`

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
    IssueView(
      variables: IssueViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueViewQuery>({
            document: IssueViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
