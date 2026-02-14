import type * as Types from '../generated/common-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type IssueParentSetMutationVariables = Types.Exact<{
  issueId: Types.Scalars['ID']['input'];
  parentIssueId: Types.Scalars['ID']['input'];
}>;


export type IssueParentSetMutation = { __typename?: 'Mutation', addSubIssue?: { __typename?: 'AddSubIssuePayload', issue?: { __typename?: 'Issue', id: string } | null, subIssue?: { __typename?: 'Issue', id: string } | null } | null };


export const IssueParentSetDocument = `
    mutation IssueParentSet($issueId: ID!, $parentIssueId: ID!) {
  addSubIssue(input: {issueId: $parentIssueId, subIssueId: $issueId}) {
    issue {
      id
    }
    subIssue {
      id
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    IssueParentSet(variables: IssueParentSetMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<IssueParentSetMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<IssueParentSetMutation>({ document: IssueParentSetDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'IssueParentSet', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;