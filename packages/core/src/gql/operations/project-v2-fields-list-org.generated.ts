import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"
import { PageInfoFieldsFragmentDoc } from "./fragments/page-info-fields.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type ProjectV2CommonFields_ProjectV2Field_Fragment = {
  __typename?: "ProjectV2Field"
  id: string
  name: string
  dataType: Types.ProjectV2FieldType
}

export type ProjectV2CommonFields_ProjectV2IterationField_Fragment = {
  __typename?: "ProjectV2IterationField"
  id: string
  name: string
  dataType: Types.ProjectV2FieldType
}

export type ProjectV2CommonFields_ProjectV2SingleSelectField_Fragment = {
  __typename?: "ProjectV2SingleSelectField"
  id: string
  name: string
  dataType: Types.ProjectV2FieldType
}

export type ProjectV2CommonFieldsFragment =
  | ProjectV2CommonFields_ProjectV2Field_Fragment
  | ProjectV2CommonFields_ProjectV2IterationField_Fragment
  | ProjectV2CommonFields_ProjectV2SingleSelectField_Fragment

export type ProjectV2FieldsListOrgQueryVariables = Types.Exact<{
  owner: Types.Scalars["String"]["input"]
  projectNumber: Types.Scalars["Int"]["input"]
  first: Types.Scalars["Int"]["input"]
  after?: Types.InputMaybe<Types.Scalars["String"]["input"]>
}>

export type ProjectV2FieldsListOrgQuery = {
  __typename?: "Query"
  organization?: {
    __typename?: "Organization"
    projectV2?: {
      __typename?: "ProjectV2"
      fields: {
        __typename?: "ProjectV2FieldConfigurationConnection"
        nodes?: Array<
          | {
              __typename?: "ProjectV2Field"
              id: string
              name: string
              dataType: Types.ProjectV2FieldType
            }
          | {
              __typename?: "ProjectV2IterationField"
              id: string
              name: string
              dataType: Types.ProjectV2FieldType
            }
          | {
              __typename?: "ProjectV2SingleSelectField"
              id: string
              name: string
              dataType: Types.ProjectV2FieldType
              options: Array<{
                __typename?: "ProjectV2SingleSelectFieldOption"
                id: string
                name: string
              }>
            }
          | null
        > | null
        pageInfo: { __typename?: "PageInfo"; endCursor?: string | null; hasNextPage: boolean }
      }
    } | null
  } | null
}

export const ProjectV2CommonFieldsFragmentDoc = `
    fragment ProjectV2CommonFields on ProjectV2FieldCommon {
  id
  name
  dataType
}
    `
export const ProjectV2FieldsListOrgDocument = `
    query ProjectV2FieldsListOrg($owner: String!, $projectNumber: Int!, $first: Int!, $after: String) {
  organization(login: $owner) {
    projectV2(number: $projectNumber) {
      fields(first: $first, after: $after) {
        nodes {
          ... on ProjectV2FieldCommon {
            ...ProjectV2CommonFields
          }
          ... on ProjectV2SingleSelectField {
            options {
              id
              name
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
    ${ProjectV2CommonFieldsFragmentDoc}
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
    ProjectV2FieldsListOrg(
      variables: ProjectV2FieldsListOrgQueryVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<ProjectV2FieldsListOrgQuery> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<ProjectV2FieldsListOrgQuery>({
            document: ProjectV2FieldsListOrgDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "ProjectV2FieldsListOrg",
        "query",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
