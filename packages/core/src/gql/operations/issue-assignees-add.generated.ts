import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueAssigneesAddMutationVariables = Types.Exact<{
  assignableId: Types.Scalars["ID"]["input"]
  assigneeIds: Array<Types.Scalars["ID"]["input"]> | Types.Scalars["ID"]["input"]
}>

export type IssueAssigneesAddMutation = {
  __typename?: "Mutation"
  addAssigneesToAssignable?: {
    __typename?: "AddAssigneesToAssignablePayload"
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

export const IssueAssigneesAddDocument = `
    mutation IssueAssigneesAdd($assignableId: ID!, $assigneeIds: [ID!]!) {
  addAssigneesToAssignable(
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
    IssueAssigneesAdd(
      variables: IssueAssigneesAddMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueAssigneesAddMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueAssigneesAddMutation>({
            document: IssueAssigneesAddDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueAssigneesAdd",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
