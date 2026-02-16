import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueMilestoneSetMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
  milestoneId?: Types.InputMaybe<Types.Scalars["ID"]["input"]>
}>

export type IssueMilestoneSetMutation = {
  __typename?: "Mutation"
  updateIssue?: {
    __typename?: "UpdateIssuePayload"
    issue?: {
      __typename?: "Issue"
      id: string
      milestone?: { __typename?: "Milestone"; number: number } | null
    } | null
  } | null
}

export const IssueMilestoneSetDocument = `
    mutation IssueMilestoneSet($issueId: ID!, $milestoneId: ID) {
  updateIssue(input: {id: $issueId, milestoneId: $milestoneId}) {
    issue {
      id
      milestone {
        number
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
    IssueMilestoneSet(
      variables: IssueMilestoneSetMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueMilestoneSetMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueMilestoneSetMutation>({
            document: IssueMilestoneSetDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueMilestoneSet",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
