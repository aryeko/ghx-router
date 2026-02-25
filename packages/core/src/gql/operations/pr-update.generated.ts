import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrUpdateMutationVariables = Types.Exact<{
  pullRequestId: Types.Scalars["ID"]["input"]
  title?: Types.InputMaybe<Types.Scalars["String"]["input"]>
  body?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type PrUpdateMutation = {
  __typename?: "Mutation"
  updatePullRequest?: {
    __typename?: "UpdatePullRequestPayload"
    pullRequest?: {
      __typename?: "PullRequest"
      id: string
      number: number
      title: string
      state: Types.PullRequestState
      url: any
      isDraft: boolean
    } | null
  } | null
}

export const PrUpdateDocument = `
    mutation PrUpdate($pullRequestId: ID!, $title: String, $body: String) {
  updatePullRequest(
    input: {pullRequestId: $pullRequestId, title: $title, body: $body}
  ) {
    pullRequest {
      id
      number
      title
      state
      url
      isDraft
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
    PrUpdate(
      variables: PrUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrUpdateMutation>({
            document: PrUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
