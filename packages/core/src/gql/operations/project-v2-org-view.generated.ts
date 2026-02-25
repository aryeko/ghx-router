import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ProjectV2OrgViewQueryVariables = Types.Exact<{
  org: Types.Scalars["String"]["input"]
  projectNumber: Types.Scalars["Int"]["input"]
}>

export type ProjectV2OrgViewQuery = {
  __typename?: "Query"
  organization?: {
    __typename?: "Organization"
    projectV2?: {
      __typename?: "ProjectV2"
      id: string
      title: string
      shortDescription?: string | null
      public: boolean
      closed: boolean
      url: any
    } | null
  } | null
}

export const ProjectV2OrgViewDocument = `
    query ProjectV2OrgView($org: String!, $projectNumber: Int!) {
  organization(login: $org) {
    projectV2(number: $projectNumber) {
      id
      title
      shortDescription
      public
      closed
      url
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
    ProjectV2OrgView(
      variables: ProjectV2OrgViewQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2OrgViewQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2OrgViewQuery>({
            document: ProjectV2OrgViewDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2OrgView",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
