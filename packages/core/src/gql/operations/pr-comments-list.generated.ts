import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrCommentsListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type PrCommentsListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: {
      __typename?: "PullRequest"
      reviewThreads: {
        __typename?: "PullRequestReviewThreadConnection"
        edges?: Array<{
          __typename?: "PullRequestReviewThreadEdge"
          cursor: string
          node?: {
            __typename?: "PullRequestReviewThread"
            id: string
            path: string
            line?: number | null
            startLine?: number | null
            diffSide: Types.DiffSide
            subjectType: Types.PullRequestReviewThreadSubjectType
            isResolved: boolean
            isOutdated: boolean
            viewerCanReply: boolean
            viewerCanResolve: boolean
            viewerCanUnresolve: boolean
            resolvedBy?: { __typename?: "User"; login: string } | null
            comments: {
              __typename?: "PullRequestReviewCommentConnection"
              nodes?: Array<{
                __typename?: "PullRequestReviewComment"
                id: string
                body: string
                createdAt: any
                url: any
                author?:
                  | { __typename?: "Bot"; login: string }
                  | { __typename?: "EnterpriseUserAccount"; login: string }
                  | { __typename?: "Mannequin"; login: string }
                  | { __typename?: "Organization"; login: string }
                  | { __typename?: "User"; login: string }
                  | null
              } | null> | null
            }
          } | null
        } | null> | null
        pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
      }
    } | null
  } | null
}

export const PrCommentsListDocument = `
    query PrCommentsList($owner: String!, $name: String!, $prNumber: Int!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      reviewThreads(first: $first, after: $after) {
        edges {
          cursor
          node {
            id
            path
            line
            startLine
            diffSide
            subjectType
            isResolved
            isOutdated
            viewerCanReply
            viewerCanResolve
            viewerCanUnresolve
            resolvedBy {
              login
            }
            comments(first: 20) {
              nodes {
                id
                body
                createdAt
                url
                author {
                  login
                }
              }
            }
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
    PrCommentsList(
      variables: PrCommentsListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrCommentsListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrCommentsListQuery>({
            document: PrCommentsListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrCommentsList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
