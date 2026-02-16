import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueAssigneesUpdateMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
  assigneeIds: Array<Types.Scalars["ID"]["input"]> | Types.Scalars["ID"]["input"]
}>

export type IssueAssigneesUpdateMutation = {
  __typename?: "Mutation"
  updateIssue?: {
    __typename?: "UpdateIssuePayload"
    issue?: {
      __typename?: "Issue"
      id: string
      assignees: {
        __typename?: "UserConnection"
        nodes?: Array<{ __typename?: "User"; login: string } | null> | null
      }
    } | null
  } | null
}

export const IssueAssigneesUpdateDocument = `
    mutation IssueAssigneesUpdate($issueId: ID!, $assigneeIds: [ID!]!) {
  updateIssue(input: {id: $issueId, assigneeIds: $assigneeIds}) {
    issue {
      id
      assignees(first: 50) {
        nodes {
          login
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
    IssueAssigneesUpdate(
      variables: IssueAssigneesUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueAssigneesUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueAssigneesUpdateMutation>({
            document: IssueAssigneesUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueAssigneesUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
