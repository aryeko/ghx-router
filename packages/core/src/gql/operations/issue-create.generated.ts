import type * as Types from '../generated/common-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type IssueCreateMutationVariables = Types.Exact<{
  repositoryId: Types.Scalars['ID']['input'];
  title: Types.Scalars['String']['input'];
  body?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type IssueCreateMutation = { __typename?: 'Mutation', createIssue?: { __typename?: 'CreateIssuePayload', issue?: { __typename?: 'Issue', id: string, number: number, title: string, state: Types.IssueState, url: any } | null } | null };


export const IssueCreateDocument = `
    mutation IssueCreate($repositoryId: ID!, $title: String!, $body: String) {
  createIssue(input: {repositoryId: $repositoryId, title: $title, body: $body}) {
    issue {
      id
      number
      title
      state
      url
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    IssueCreate(variables: IssueCreateMutationVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<IssueCreateMutation> {
      return withWrapper((wrappedRequestHeaders) => client.request<IssueCreateMutation>({ document: IssueCreateDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'IssueCreate', 'mutation', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;