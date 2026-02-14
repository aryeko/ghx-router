import type * as Types from '../generated/common-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type IssueCloseMutationVariables = Types.Exact<{
  issueId: Types.Scalars['ID']['input'];
}>;


export type IssueCloseMutation = { __typename?: 'Mutation', closeIssue?: { __typename?: 'CloseIssuePayload', issue?: { __typename?: 'Issue', id: string, number: number, state: Types.IssueState } | null } | null };


export const IssueCloseDocument = `
    mutation IssueClose($issueId: ID!) {
  closeIssue(input: {issueId: $issueId}) {
    issue {
      id
      number
      state
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    IssueClose(variables: IssueCloseMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<IssueCloseMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<IssueCloseMutation>({ document: IssueCloseDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'IssueClose', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;