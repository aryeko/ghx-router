import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueUpdateMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
  title?: Types.InputMaybe<Types.Scalars["String"]["input"]>
  body?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type IssueUpdateMutation = {
  __typename?: "Mutation"
  updateIssue?: {
    __typename?: "UpdateIssuePayload"
    issue?: {
      __typename?: "Issue"
      id: string
      number: number
      title: string
      state: Types.IssueState
      url: any
    } | null
  } | null
}

export const IssueUpdateDocument = `
    mutation IssueUpdate($issueId: ID!, $title: String, $body: String) {
  updateIssue(input: {id: $issueId, title: $title, body: $body}) {
    issue {
      id
      number
      title
      state
      url
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
    IssueUpdate(
      variables: IssueUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueUpdateMutation>({
            document: IssueUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
