import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type UserNodeIdQueryVariables = Types.Exact<{
  login: Types.Scalars["String"]["input"]
}>

export type UserNodeIdQuery = {
  __typename?: "Query"
  user?: { __typename?: "User"; id: string } | null
}

export const UserNodeIdDocument = `
    query UserNodeId($login: String!) {
  user(login: $login) {
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
    UserNodeId(
      variables: UserNodeIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UserNodeIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UserNodeIdQuery>({
            document: UserNodeIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "UserNodeId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
