import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type PrAssigneesRemoveMutationVariables = Types.Exact<{
  assignableId: Types.Scalars["ID"]["input"]
  assigneeIds: Array<Types.Scalars["ID"]["input"]> | Types.Scalars["ID"]["input"]
}>

export type PrAssigneesRemoveMutation = {
  __typename?: "Mutation"
  removeAssigneesFromAssignable?: {
    __typename?: "RemoveAssigneesFromAssignablePayload"
    assignable?:
      | { __typename?: "Issue" }
      | {
          __typename?: "PullRequest"
          id: string
          assignees: {
            __typename?: "UserConnection"
            nodes?: Array<{ __typename?: "User"; login: string } | null> | null
          }
        }
      | null
  } | null
}

export const PrAssigneesRemoveDocument = `
    mutation PrAssigneesRemove($assignableId: ID!, $assigneeIds: [ID!]!) {
  removeAssigneesFromAssignable(
    input: {assignableId: $assignableId, assigneeIds: $assigneeIds}
  ) {
    assignable {
      ... on PullRequest {
        id
        assignees(first: 50) {
          nodes {
            login
          }
        }
      }
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
    PrAssigneesRemove(
      variables: PrAssigneesRemoveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<PrAssigneesRemoveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<PrAssigneesRemoveMutation>({
            document: PrAssigneesRemoveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "PrAssigneesRemove",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
