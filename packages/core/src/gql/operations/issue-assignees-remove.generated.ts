import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueAssigneesRemoveMutationVariables = Types.Exact<{
  assignableId: Types.Scalars["ID"]["input"]
  assigneeIds: Array<Types.Scalars["ID"]["input"]> | Types.Scalars["ID"]["input"]
}>

export type IssueAssigneesRemoveMutation = {
  __typename?: "Mutation"
  removeAssigneesFromAssignable?: {
    __typename?: "RemoveAssigneesFromAssignablePayload"
    assignable?:
      | {
          __typename?: "Issue"
          id: string
          assignees: {
            __typename?: "UserConnection"
            nodes?: Array<{ __typename?: "User"; login: string } | null> | null
          }
        }
      | { __typename?: "PullRequest" }
      | null
  } | null
}

export const IssueAssigneesRemoveDocument = `
    mutation IssueAssigneesRemove($assignableId: ID!, $assigneeIds: [ID!]!) {
  removeAssigneesFromAssignable(
    input: {assignableId: $assignableId, assigneeIds: $assigneeIds}
  ) {
    assignable {
      ... on Issue {
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
    IssueAssigneesRemove(
      variables: IssueAssigneesRemoveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueAssigneesRemoveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueAssigneesRemoveMutation>({
            document: IssueAssigneesRemoveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueAssigneesRemove",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
