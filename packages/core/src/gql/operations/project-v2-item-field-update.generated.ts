import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type UpdateProjectV2ItemFieldMutationVariables = Types.Exact<{
  projectId: Types.Scalars["ID"]["input"]
  itemId: Types.Scalars["ID"]["input"]
  fieldId: Types.Scalars["ID"]["input"]
  value: Types.ProjectV2FieldValue
}>

export type UpdateProjectV2ItemFieldMutation = {
  __typename?: "Mutation"
  updateProjectV2ItemFieldValue?: {
    __typename?: "UpdateProjectV2ItemFieldValuePayload"
    projectV2Item?: { __typename?: "ProjectV2Item"; id: string } | null
  } | null
}

export const UpdateProjectV2ItemFieldDocument = `
    mutation UpdateProjectV2ItemField($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
  updateProjectV2ItemFieldValue(
    input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value}
  ) {
    projectV2Item {
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
    UpdateProjectV2ItemField(
      variables: UpdateProjectV2ItemFieldMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<UpdateProjectV2ItemFieldMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<UpdateProjectV2ItemFieldMutation>({
            document: UpdateProjectV2ItemFieldDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "UpdateProjectV2ItemField",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
