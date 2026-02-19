import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrCommentReplyMutationVariables = Types.Exact<{
  threadId: Types.Scalars["ID"]["input"]
  body: Types.Scalars["String"]["input"]
}>

export type PrCommentReplyMutation = {
  __typename?: "Mutation"
  addPullRequestReviewThreadReply?: {
    __typename?: "AddPullRequestReviewThreadReplyPayload"
    comment?: { __typename?: "PullRequestReviewComment"; id: string } | null
  } | null
}

export const PrCommentReplyDocument = `
    mutation PrCommentReply($threadId: ID!, $body: String!) {
  addPullRequestReviewThreadReply(
    input: {pullRequestReviewThreadId: $threadId, body: $body}
  ) {
    comment {
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
    PrCommentReply(
      variables: PrCommentReplyMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCommentReplyMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCommentReplyMutation>({
            document: PrCommentReplyDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCommentReply",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
