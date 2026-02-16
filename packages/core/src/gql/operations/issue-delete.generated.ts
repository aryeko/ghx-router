import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueDeleteMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
}>

export type IssueDeleteMutation = {
  __typename?: "Mutation"
  deleteIssue?: { __typename?: "DeleteIssuePayload"; clientMutationId?: string | null } | null
}

export const IssueDeleteDocument = `
    mutation IssueDelete($issueId: ID!) {
  deleteIssue(input: {issueId: $issueId}) {
    clientMutationId
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
    IssueDelete(
      variables: IssueDeleteMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueDeleteMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueDeleteMutation>({
            document: IssueDeleteDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueDelete",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
