import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueCreateRepositoryIdQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  name: Types.Scalars["String"]["input"]
}>

export type IssueCreateRepositoryIdQuery = {
  __typename?: "Query"
  repository?: { __typename?: "Repository"; id: string } | null
}

export const IssueCreateRepositoryIdDocument = `
    query IssueCreateRepositoryId($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    id
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
    IssueCreateRepositoryId(
      variables: IssueCreateRepositoryIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueCreateRepositoryIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueCreateRepositoryIdQuery>({
            document: IssueCreateRepositoryIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueCreateRepositoryId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
