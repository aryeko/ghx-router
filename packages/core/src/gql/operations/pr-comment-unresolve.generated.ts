import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrCommentUnresolveMutationVariables = Types.Exact<{
  threadId: Types.Scalars["ID"]["input"]
}>

export type PrCommentUnresolveMutation = {
  __typename?: "Mutation"
  unresolveReviewThread?: {
    __typename?: "UnresolveReviewThreadPayload"
    thread?: { __typename?: "PullRequestReviewThread"; id: string; isResolved: boolean } | null
  } | null
}

export const PrCommentUnresolveDocument = `
    mutation PrCommentUnresolve($threadId: ID!) {
  unresolveReviewThread(input: {threadId: $threadId}) {
    thread {
      id
      isResolved
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
    PrCommentUnresolve(
      variables: PrCommentUnresolveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCommentUnresolveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCommentUnresolveMutation>({
            document: PrCommentUnresolveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCommentUnresolve",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
