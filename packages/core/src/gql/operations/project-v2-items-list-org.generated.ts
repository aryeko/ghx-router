import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ProjectV2ItemsListOrgQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  projectNumber: Types.Scalars["Int"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type ProjectV2ItemsListOrgQuery = {
  __typename?: "Query"
  organization?: {
    __typename?: "Organization"
    projectV2?: {
      __typename?: "ProjectV2"
      items: {
        __typename?: "ProjectV2ItemConnection"
        nodes?: Array<{
          __typename?: "ProjectV2Item"
          id: string
          type: Types.ProjectV2ItemType
          content?:
            | { __typename?: "DraftIssue"; title: string }
            | { __typename?: "Issue"; number: number; title: string }
            | { __typename?: "PullRequest"; number: number; title: string }
            | null
        } | null> | null
        pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
      }
    } | null
  } | null
}

export const ProjectV2ItemsListOrgDocument = `
    query ProjectV2ItemsListOrg($owner: String!, $projectNumber: Int!, $first: Int!, $after: String) {
  organization(login: $owner) {
    projectV2(number: $projectNumber) {
      items(first: $first, after: $after) {
        nodes {
          id
          type
          content {
            ... on Issue {
              number
              title
            }
            ... on PullRequest {
              number
              title
            }
            ... on DraftIssue {
              title
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
    ProjectV2ItemsListOrg(
      variables: ProjectV2ItemsListOrgQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2ItemsListOrgQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2ItemsListOrgQuery>({
            document: ProjectV2ItemsListOrgDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2ItemsListOrg",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
