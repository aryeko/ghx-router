import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ProjectV2ItemsListUserQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  projectNumber: Types.Scalars["Int"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type ProjectV2ItemsListUserQuery = {
  __typename?: "Query"
  user?: {
    __typename?: "User"
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

export const ProjectV2ItemsListUserDocument = `
    query ProjectV2ItemsListUser($owner: String!, $projectNumber: Int!, $first: Int!, $after: String) {
  user(login: $owner) {
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
    ProjectV2ItemsListUser(
      variables: ProjectV2ItemsListUserQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2ItemsListUserQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2ItemsListUserQuery>({
            document: ProjectV2ItemsListUserDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2ItemsListUser",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
