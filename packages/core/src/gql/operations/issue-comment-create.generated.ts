import type { GraphQLClient, RequestOptions } from "graphql-request"
import type * as Types from "../generated/common-types.generated.js"

type GraphQLClientRequestHeaders = RequestOptions["requestHeaders"]
export type IssueCommentCreateMutationVariables = Types.Exact<{
  issueId: Types.Scalars["ID"]["input"]
  body: Types.Scalars["String"]["input"]
}>

export type IssueCommentCreateMutation = {
  __typename?: "Mutation"
  addComment?: {
    __typename?: "AddCommentPayload"
    commentEdge?: {
      __typename?: "IssueCommentEdge"
      node?: { __typename?: "IssueComment"; id: string; body: string; url: any } | null
    } | null
  } | null
}

export const IssueCommentCreateDocument = `
    mutation IssueCommentCreate($issueId: ID!, $body: String!) {
  addComment(input: {subjectId: $issueId, body: $body}) {
    commentEdge {
      node {
        id
        body
        url
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
    IssueCommentCreate(
      variables: IssueCommentCreateMutationVariables,
      requestHeaders?: GraphQLClientRequestHeaders,
      signal?: RequestInit["signal"],
    ): Promise<IssueCommentCreateMutation> {
      return withWrapper(
        (wrappedRequestHeaders) =>
          client.request<IssueCommentCreateMutation>({
            document: IssueCommentCreateDocument,
            variables,
            requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders },
            signal,
          }),
        "IssueCommentCreate",
        "mutation",
        variables,
      )
    },
  }
}
export type Sdk = ReturnType<typeof getSdk>
