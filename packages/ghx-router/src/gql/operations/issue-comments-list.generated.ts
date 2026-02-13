import type * as Types from '../generated/common-types';

import type { GraphQLClient, RequestOptions } from 'graphql-request';
type GraphQLClientRequestHeaders = RequestOptions['requestHeaders'];
export type IssueCommentsListQueryVariables = Types.Exact<{
  owner: Types.Scalars['String']['input'];
  name: Types.Scalars['String']['input'];
  issueNumber: Types.Scalars['Int']['input'];
  first: Types.Scalars['Int']['input'];
  after?: Types.InputMaybe<Types.Scalars['String']['input']>;
}>;


export type IssueCommentsListQuery = { __typename?: 'Query', repository?: { __typename?: 'Repository', issue?: { __typename?: 'Issue', comments: { __typename?: 'IssueCommentConnection', nodes?: Array<{ __typename?: 'IssueComment', id: string, body: string, createdAt: any, url: any, author?: { __typename?: 'Bot', login: string } | { __typename?: 'EnterpriseUserAccount', login: string } | { __typename?: 'Mannequin', login: string } | { __typename?: 'Organization', login: string } | { __typename?: 'User', login: string } | null } | null> | null, pageInfo: { __typename?: 'PageInfo', endCursor?: string | null, hasNextPage: boolean } } } | null } | null };


export const IssueCommentsListDocument = `
    query IssueCommentsList($owner: String!, $name: String!, $issueNumber: Int!, $first: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    issue(number: $issueNumber) {
      comments(first: $first, after: $after) {
        nodes {
          id
          body
          createdAt
          url
          author {
            login
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  }
}
    `;

export type SdkFunctionWrapper = <T>(action: (requestHeaders?:Record<string, string>) => Promise<T>, operationName: string, operationType?: string, variables?: any) => Promise<T>;


const defaultWrapper: SdkFunctionWrapper = (action, _operationName, _operationType, _variables) => action();

export function getSdk(client: GraphQLClient, withWrapper: SdkFunctionWrapper = defaultWrapper) {
  return {
    IssueCommentsList(variables: IssueCommentsListQueryVariables, requestHeaders?: GraphQLClientRequestHeaders, signal?: RequestInit['signal']): Promise<IssueCommentsListQuery> {
      return withWrapper((wrappedRequestHeaders) => client.request<IssueCommentsListQuery>({ document: IssueCommentsListDocument, variables, requestHeaders: { ...requestHeaders, ...wrappedRequestHeaders }, signal }), 'IssueCommentsList', 'query', variables);
    }
  };
}
export type Sdk = ReturnType<typeof getSdk>;