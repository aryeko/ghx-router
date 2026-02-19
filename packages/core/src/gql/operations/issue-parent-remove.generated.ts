import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueParentRemoveMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
  parentIssueId: Types.Scalars["ID"]["input"]
}>

export type IssueParentRemoveMutation = {
  __typename?: "Mutation"
  removeSubIssue?: {
    __typename?: "RemoveSubIssuePayload"
    issue?: { __typename?: "Issue"; id: string } | null
    subIssue?: { __typename?: "Issue"; id: string } | null
  } | null
}

export const IssueParentRemoveDocument = `
    mutation IssueParentRemove($issueId: ID!, $parentIssueId: ID!) {
  removeSubIssue(input: {issueId: $parentIssueId, subIssueId: $issueId}) {
    issue {
      id
    }
    subIssue {
      id
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
    IssueParentRemove(
      variables: IssueParentRemoveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueParentRemoveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueParentRemoveMutation>({
            document: IssueParentRemoveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueParentRemove",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
