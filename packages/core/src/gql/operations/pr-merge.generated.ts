import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrMergeMutationVariables = Types.Exact<{
  pullRequestId: Types.Scalars["ID"]["input"]
  mergeMethod?: Types.InputMaybe<Types.PullRequestMergeMethod>
}>

export type PrMergeMutation = {
  __typename?: "Mutation"
  mergePullRequest?: {
    __typename?: "MergePullRequestPayload"
    pullRequest?: {
      __typename?: "PullRequest"
      id: string
      number: number
      state: Types.PullRequestState
      merged: boolean
      mergedAt?: any | null
    } | null
  } | null
}

export const PrMergeDocument = `
    mutation PrMerge($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod) {
  mergePullRequest(
    input: {pullRequestId: $pullRequestId, mergeMethod: $mergeMethod}
  ) {
    pullRequest {
      id
      number
      state
      merged
      mergedAt
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
    PrMerge(
      variables: PrMergeMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrMergeMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrMergeMutation>({
            document: PrMergeDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrMerge",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
