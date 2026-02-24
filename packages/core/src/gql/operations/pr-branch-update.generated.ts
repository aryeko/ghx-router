import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrBranchUpdateMutationVariables = Types.Exact<{
  pullRequestId: Types.Scalars["ID"]["input"]
  updateMethod?: Types.InputMaybe<Types.PullRequestBranchUpdateMethod>
}>

export type PrBranchUpdateMutation = {
  __typename?: "Mutation"
  updatePullRequestBranch?: {
    __typename?: "UpdatePullRequestBranchPayload"
    pullRequest?: { __typename?: "PullRequest"; id: string; number: number } | null
  } | null
}

export const PrBranchUpdateDocument = `
    mutation PrBranchUpdate($pullRequestId: ID!, $updateMethod: PullRequestBranchUpdateMethod) {
  updatePullRequestBranch(
    input: {pullRequestId: $pullRequestId, updateMethod: $updateMethod}
  ) {
    pullRequest {
      id
      number
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
    PrBranchUpdate(
      variables: PrBranchUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrBranchUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrBranchUpdateMutation>({
            document: PrBranchUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrBranchUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
