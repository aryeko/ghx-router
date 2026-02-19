import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrMergeStatusQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
}>

export type PrMergeStatusQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: {
      __typename?: "PullRequest"
      mergeable: Types.MergeableState
      mergeStateStatus: Types.MergeStateStatus
      reviewDecision?: Types.PullRequestReviewDecision | null
      isDraft: boolean
      state: Types.PullRequestState
    } | null
  } | null
}

export const PrMergeStatusDocument = `
    query PrMergeStatus($owner: String!, $name: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      mergeable
      mergeStateStatus
      reviewDecision
      isDraft
      state
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
    PrMergeStatus(
      variables: PrMergeStatusQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrMergeStatusQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrMergeStatusQuery>({
            document: PrMergeStatusDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrMergeStatus",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
