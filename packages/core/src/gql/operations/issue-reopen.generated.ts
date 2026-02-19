import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueReopenMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
}>

export type IssueReopenMutation = {
  __typename?: "Mutation"
  reopenIssue?: {
    __typename?: "ReopenIssuePayload"
    issue?: { __typename?: "Issue"; id: string; number: number; state: Types.IssueState } | null
  } | null
}

export const IssueReopenDocument = `
    mutation IssueReopen($issueId: ID!) {
  reopenIssue(input: {issueId: $issueId}) {
    issue {
      id
      number
      state
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
    IssueReopen(
      variables: IssueReopenMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueReopenMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueReopenMutation>({
            document: IssueReopenDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueReopen",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
