import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ProjectV2UserIdQueryVariables = Types.Exact<{
  login: Types.Scalars["String"]["input"]
  number: Types.Scalars["Int"]["input"]
}>

export type ProjectV2UserIdQuery = {
  __typename?: "Query"
  user?: { __typename?: "User"; projectV2?: { __typename?: "ProjectV2"; id: string } | null } | null
}

export const ProjectV2UserIdDocument = `
    query ProjectV2UserId($login: String!, $number: Int!) {
  user(login: $login) {
    projectV2(number: $number) {
      id
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
    ProjectV2UserId(
      variables: ProjectV2UserIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2UserIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2UserIdQuery>({
            document: ProjectV2UserIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2UserId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
