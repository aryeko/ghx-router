import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrReviewsListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type PrReviewsListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: {
      __typename?: "PullRequest"
      reviews?: {
        __typename?: "PullRequestReviewConnection"
        nodes?: Array<{
          __typename?: "PullRequestReview"
          id: string
          body: string
          state: Types.PullRequestReviewState
          submittedAt?: any | null
          url: any
          author?:
            | { __typename?: "Bot"; login: string }
            | { __typename?: "EnterpriseUserAccount"; login: string }
            | { __typename?: "Mannequin"; login: string }
            | { __typename?: "Organization"; login: string }
            | { __typename?: "User"; login: string }
            | null
          commit?: { __typename?: "Commit"; oid: any } | null
        } | null> | null
        pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
      } | null
    } | null
  } | null
}

export const PrReviewsListDocument = `
    query PrReviewsList($owner: String!, $name: String!, $prNumber: Int!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      reviews(first: $first, after: $after) {
        nodes {
          id
          author {
            login
          }
          body
          state
          submittedAt
          url
          commit {
            oid
          }
        }
        pageInfo {
          ...PageInfoFields
        }
      }
    }
  }
}
    ${PageInfoFieldsFragmentDoc}`

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
    PrReviewsList(
      variables: PrReviewsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrReviewsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrReviewsListQuery>({
            document: PrReviewsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrReviewsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
