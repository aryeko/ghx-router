import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrChecksListQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
}>

export type PrChecksListQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: {
      __typename?: "PullRequest"
      commits: {
        __typename?: "PullRequestCommitConnection"
        nodes?: Array<{
          __typename?: "PullRequestCommit"
          commit: {
            __typename?: "Commit"
            checkSuites?: {
              __typename?: "CheckSuiteConnection"
              nodes?: Array<{
                __typename?: "CheckSuite"
                checkRuns?: {
                  __typename?: "CheckRunConnection"
                  nodes?: Array<{
                    __typename?: "CheckRun"
                    id: string
                    name: string
                    status: Types.CheckStatusState
                    conclusion?: Types.CheckConclusionState | null
                    startedAt?: any | null
                    completedAt?: any | null
                    detailsUrl?: any | null
                  } | null> | null
                } | null
              } | null> | null
            } | null
          }
        } | null> | null
      }
    } | null
  } | null
}

export const PrChecksListDocument = `
    query PrChecksList($owner: String!, $name: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      commits(last: 1) {
        nodes {
          commit {
            checkSuites(first: 10) {
              nodes {
                checkRuns(first: 50) {
                  nodes {
                    id
                    name
                    status
                    conclusion
                    startedAt
                    completedAt
                    detailsUrl
                  }
                }
              }
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
    PrChecksList(
      variables: PrChecksListQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrChecksListQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrChecksListQuery>({
            document: PrChecksListDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrChecksList",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
