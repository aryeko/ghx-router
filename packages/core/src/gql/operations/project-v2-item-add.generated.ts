import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type AddProjectV2ItemMutationVariables = Types.Exact<{
  projectId: Types.Scalars["ID"]["input"]
  contentId: Types.Scalars["ID"]["input"]
}>

export type AddProjectV2ItemMutation = {
  __typename?: "Mutation"
  addProjectV2ItemById?: {
    __typename?: "AddProjectV2ItemByIdPayload"
    item?: { __typename?: "ProjectV2Item"; id: string; type: Types.ProjectV2ItemType } | null
  } | null
}

export const AddProjectV2ItemDocument = `
    mutation AddProjectV2Item($projectId: ID!, $contentId: ID!) {
  addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
    item {
      id
      type
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
    AddProjectV2Item(
      variables: AddProjectV2ItemMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<AddProjectV2ItemMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<AddProjectV2ItemMutation>({
            document: AddProjectV2ItemDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "AddProjectV2Item",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
