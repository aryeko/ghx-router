import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"
import { PrCoreFieldsFragmentDoc } from "./fragments/pr-core-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrViewQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
  prNumber: Types.Scalars["Int"]["input"]
}>

export type PrViewQuery = {
  __typename?: "Query"
  repository?: {
    __typename?: "Repository"
    pullRequest?: {
      __typename?: "PullRequest"
      body: string
      id: string
      number: number
      title: string
      state: Types.PullRequestState
      url: any
      labels?: {
        __typename?: "LabelConnection"
        nodes?: Array<{ __typename?: "Label"; name: string } | null> | null
      } | null
    } | null
  } | null
}

export const PrViewDocument = `
    query PrView($owner: String!, $name: String!, $prNumber: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $prNumber) {
      ...PrCoreFields
      body
      labels(first: 20) {
        nodes {
          name
        }
      }
    }
  }
}
    ${PrCoreFieldsFragmentDoc}`

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
    PrView(
      variables: PrViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrViewQuery>({
            document: PrViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
