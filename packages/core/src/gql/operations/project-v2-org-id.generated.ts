import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ProjectV2OrgIdQueryVariables = Types.Exact<{
  org: Types.Scalars["String"]["input"]
  projectNumber: Types.Scalars["Int"]["input"]
}>

export type ProjectV2OrgIdQuery = {
  __typename?: "Query"
  organization?: {
    __typename?: "Organization"
    projectV2?: { __typename?: "ProjectV2"; id: string } | null
  } | null
}

export const ProjectV2OrgIdDocument = `
    query ProjectV2OrgId($org: String!, $projectNumber: Int!) {
  organization(login: $org) {
    projectV2(number: $projectNumber) {
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
    ProjectV2OrgId(
      variables: ProjectV2OrgIdQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2OrgIdQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2OrgIdQuery>({
            document: ProjectV2OrgIdDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2OrgId",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
