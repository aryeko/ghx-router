import type * as Types from '../generated/common-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type IssueBlockedByRemoveMutationVariables = Types.Exact<{
  issueId: Types.Scalars['ID']['input'];
  blockedByIssueId: Types.Scalars['ID']['input'];
}>;


export type IssueBlockedByRemoveMutation = { __typename?: 'Mutation', removeBlockedBy?: { __typename?: 'RemoveBlockedByPayload', issue?: { __typename?: 'Issue', id: string } | null, blockingIssue?: { __typename?: 'Issue', id: string } | null } | null };


export const IssueBlockedByRemoveDocument = `
    mutation IssueBlockedByRemove($issueId: ID!, $blockedByIssueId: ID!) {
  removeBlockedBy(input: {issueId: $issueId, blockingIssueId: $blockedByIssueId}) {
    issue {
      id
    }
    blockingIssue {
      id
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    IssueBlockedByRemove(variables: IssueBlockedByRemoveMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<IssueBlockedByRemoveMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<IssueBlockedByRemoveMutation>({ document: IssueBlockedByRemoveDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'IssueBlockedByRemove', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;