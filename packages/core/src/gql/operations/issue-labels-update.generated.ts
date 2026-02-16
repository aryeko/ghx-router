import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueLabelsUpdateMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
  labelIds: Array<Types.Scalars["ID"]["input"]> | Types.Scalars["ID"]["input"]
}>

export type IssueLabelsUpdateMutation = {
  __typename?: "Mutation"
  updateIssue?: {
    __typename?: "UpdateIssuePayload"
    issue?: {
      __typename?: "Issue"
      id: string
      labels?: {
        __typename?: "LabelConnection"
        nodes?: Array<{ __typename?: "Label"; name: string } | null> | null
      } | null
    } | null
  } | null
}

export const IssueLabelsUpdateDocument = `
    mutation IssueLabelsUpdate($issueId: ID!, $labelIds: [ID!]!) {
  updateIssue(input: {id: $issueId, labelIds: $labelIds}) {
    issue {
      id
      labels(first: 50) {
        nodes {
          name
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
    IssueLabelsUpdate(
      variables: IssueLabelsUpdateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueLabelsUpdateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueLabelsUpdateMutation>({
            document: IssueLabelsUpdateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueLabelsUpdate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
