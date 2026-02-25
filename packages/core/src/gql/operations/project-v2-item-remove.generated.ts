import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type RemoveProjectV2ItemMutationVariables = Types.Exact<{
  projectId: Types.Scalars["ID"]["input"]
  itemId: Types.Scalars["ID"]["input"]
}>

export type RemoveProjectV2ItemMutation = {
  __typename?: "Mutation"
  deleteProjectV2Item?: {
    __typename?: "DeleteProjectV2ItemPayload"
    deletedItemId?: string | null
  } | null
}

export const RemoveProjectV2ItemDocument = `
    mutation RemoveProjectV2Item($projectId: ID!, $itemId: ID!) {
  deleteProjectV2Item(input: {projectId: $projectId, itemId: $itemId}) {
    deletedItemId
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
    RemoveProjectV2Item(
      variables: RemoveProjectV2ItemMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<RemoveProjectV2ItemMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<RemoveProjectV2ItemMutation>({
            document: RemoveProjectV2ItemDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "RemoveProjectV2Item",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
