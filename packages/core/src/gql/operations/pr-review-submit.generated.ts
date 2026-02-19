import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrReviewSubmitMutationVariables = Types.Exact<{
  pullRequestId: Types.Scalars["ID"]["input"]
  event: Types.PullRequestReviewEvent
  body?: Types.InputMaybe<Types.Scalars["String"]["input"]>
  threads?: Types.InputMaybe<
    Array<Types.DraftPullRequestReviewThread> | Types.DraftPullRequestReviewThread
  >
}>

export type PrReviewSubmitMutation = {
  __typename?: "Mutation"
  addPullRequestReview?: {
    __typename?: "AddPullRequestReviewPayload"
    pullRequestReview?: {
      __typename?: "PullRequestReview"
      id: string
      state: Types.PullRequestReviewState
      url: any
      body: string
    } | null
  } | null
}

export const PrReviewSubmitDocument = `
    mutation PrReviewSubmit($pullRequestId: ID!, $event: PullRequestReviewEvent!, $body: String, $threads: [DraftPullRequestReviewThread!]) {
  addPullRequestReview(
    input: {pullRequestId: $pullRequestId, event: $event, body: $body, threads: $threads}
  ) {
    pullRequestReview {
      id
      state
      url
      body
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
    PrReviewSubmit(
      variables: PrReviewSubmitMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrReviewSubmitMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrReviewSubmitMutation>({
            document: PrReviewSubmitDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrReviewSubmit",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
