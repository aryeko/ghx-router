import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrReviewsRequestMutationVariables = Types.Exact<{
  pullRequestId: Types.Scalars["ID"]["input"]
  userIds: Array<Types.Scalars["ID"]["input"]> | Types.Scalars["ID"]["input"]
}>

export type PrReviewsRequestMutation = {
  __typename?: "Mutation"
  requestReviews?: {
    __typename?: "RequestReviewsPayload"
    pullRequest?: {
      __typename?: "PullRequest"
      id: string
      number: number
      reviewRequests?: {
        __typename?: "ReviewRequestConnection"
        nodes?: Array<{
          __typename?: "ReviewRequest"
          requestedReviewer?:
            | { __typename?: "Bot" }
            | { __typename?: "Mannequin" }
            | { __typename?: "Team" }
            | { __typename?: "User"; login: string }
            | null
        } | null> | null
      } | null
    } | null
  } | null
}

export const PrReviewsRequestDocument = `
    mutation PrReviewsRequest($pullRequestId: ID!, $userIds: [ID!]!) {
  requestReviews(input: {pullRequestId: $pullRequestId, userIds: $userIds}) {
    pullRequest {
      id
      number
      reviewRequests(first: 10) {
        nodes {
          requestedReviewer {
            ... on User {
              login
            }
          }
        }
      }
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
    PrReviewsRequest(
      variables: PrReviewsRequestMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrReviewsRequestMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrReviewsRequestMutation>({
            document: PrReviewsRequestDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrReviewsRequest",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
