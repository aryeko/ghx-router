import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueLabelsRemoveMutationVariables = Types.Exact<{
  labelableId: Types.Scalars["ID"]["input"]
  labelIds: Array<Types.Scalars["ID"]["input"]> | Types.Scalars["ID"]["input"]
}>

export type IssueLabelsRemoveMutation = {
  __typename?: "Mutation"
  removeLabelsFromLabelable?: {
    __typename?: "RemoveLabelsFromLabelablePayload"
    labelable?:
      | { __typename?: "Discussion" }
      | {
          __typename?: "Issue"
          id: string
          labels?: {
            __typename?: "LabelConnection"
            nodes?: Array<{ __typename?: "Label"; name: string } | null> | null
          } | null
        }
      | { __typename?: "PullRequest" }
      | null
  } | null
}

export const IssueLabelsRemoveDocument = `
    mutation IssueLabelsRemove($labelableId: ID!, $labelIds: [ID!]!) {
  removeLabelsFromLabelable(
    input: {labelableId: $labelableId, labelIds: $labelIds}
  ) {
    labelable {
      ... on Issue {
        id
        labels(first: 50) {
          nodes {
            name
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
    IssueLabelsRemove(
      variables: IssueLabelsRemoveMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueLabelsRemoveMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueLabelsRemoveMutation>({
            document: IssueLabelsRemoveDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueLabelsRemove",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
