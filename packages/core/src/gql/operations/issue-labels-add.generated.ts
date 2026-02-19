import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "./base-types.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueLabelsAddMutationVariables = Types.Exact<{
  labelableId: Types.Scalars["ID"]["input"]
  labelIds: Array<Types.Scalars["ID"]["input"]> | Types.Scalars["ID"]["input"]
}>

export type IssueLabelsAddMutation = {
  __typename?: "Mutation"
  addLabelsToLabelable?: {
    __typename?: "AddLabelsToLabelablePayload"
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

export const IssueLabelsAddDocument = `
    mutation IssueLabelsAdd($labelableId: ID!, $labelIds: [ID!]!) {
  addLabelsToLabelable(input: {labelableId: $labelableId, labelIds: $labelIds}) {
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
    IssueLabelsAdd(
      variables: IssueLabelsAddMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueLabelsAddMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueLabelsAddMutation>({
            document: IssueLabelsAddDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueLabelsAdd",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
