import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueBlockedByAddMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
  blockedByIssueId: Types.Scalars["ID"]["input"]
}>

export type IssueBlockedByAddMutation = {
  __typename?: "Mutation"
  addBlockedBy?: {
    __typename?: "AddBlockedByPayload"
    issue?: { __typename?: "Issue"; id: string } | null
    blockingIssue?: { __typename?: "Issue"; id: string } | null
  } | null
}

export const IssueBlockedByAddDocument = `
    mutation IssueBlockedByAdd($issueId: ID!, $blockedByIssueId: ID!) {
  addBlockedBy(input: {issueId: $issueId, blockingIssueId: $blockedByIssueId}) {
    issue {
      id
    }
    blockingIssue {
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
    IssueBlockedByAdd(
      variables: IssueBlockedByAddMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueBlockedByAddMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueBlockedByAddMutation>({
            document: IssueBlockedByAddDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueBlockedByAdd",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
