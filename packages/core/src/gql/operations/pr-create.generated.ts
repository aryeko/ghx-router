import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrCreateMutationVariables = Types.Exact<{
  repositoryId: Types.Scalars["ID"]["input"]
  baseRefName: Types.Scalars["String"]["input"]
  headRefName: Types.Scalars["String"]["input"]
  title: Types.Scalars["String"]["input"]
  body?: Types.InputMaybe<Types.Scalars["String"]["input"]>
  draft?: Types.InputMaybe<Types.Scalars["Boolean"]["input"]>
}>

export type PrCreateMutation = {
  __typename?: "Mutation"
  createPullRequest?: {
    __typename?: "CreatePullRequestPayload"
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

export const PrCreateDocument = `
    mutation PrCreate($repositoryId: ID!, $baseRefName: String!, $headRefName: String!, $title: String!, $body: String, $draft: Boolean) {
  createPullRequest(
    input: {repositoryId: $repositoryId, baseRefName: $baseRefName, headRefName: $headRefName, title: $title, body: $body, draft: $draft}
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
    PrCreate(
      variables: PrCreateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCreateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCreateMutation>({
            document: PrCreateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCreate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
