import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrCommentResolveMutationVariables = Types.Exact<{
  threadId: Types.Scalars["ID"]["input"]
}>

export type PrCommentResolveMutation = {
  __typename?: "Mutation"
  resolveReviewThread?: {
    __typename?: "ResolveReviewThreadPayload"
    thread?: { __typename?: "PullRequestReviewThread"; id: string; isResolved: boolean } | null
  } | null
}

export const PrCommentResolveDocument = `
    mutation PrCommentResolve($threadId: ID!) {
  resolveReviewThread(input: {threadId: $threadId}) {
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
    PrCommentResolve(
      variables: PrCommentResolveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCommentResolveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCommentResolveMutation>({
            document: PrCommentResolveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCommentResolve",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
