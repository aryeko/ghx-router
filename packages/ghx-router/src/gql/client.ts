import { print, type DocumentNode } from "graphql"
import type { GraphQLClient, RequestDocument, RequestOptions } from "graphql-request"

import {
  getSdk as getIssueCommentsListSdk
} from "./operations/issue-comments-list.generated.js"
import {
  getSdk as getIssueListSdk
} from "./operations/issue-list.generated.js"
import {
  getSdk as getIssueViewSdk
} from "./operations/issue-view.generated.js"
import {
  getSdk as getPrListSdk
} from "./operations/pr-list.generated.js"
import {
  getSdk as getPrViewSdk
} from "./operations/pr-view.generated.js"
import {
  getSdk as getRepoViewSdk
} from "./operations/repo-view.generated.js"
import type {
  IssueCommentsListQuery,
  IssueCommentsListQueryVariables,
} from "./operations/issue-comments-list.generated.js"
import type {
  IssueListQuery,
  IssueListQueryVariables,
} from "./operations/issue-list.generated.js"
import type {
  IssueViewQuery,
  IssueViewQueryVariables,
} from "./operations/issue-view.generated.js"
import type {
  PrListQuery,
  PrListQueryVariables,
} from "./operations/pr-list.generated.js"
import type {
  PrViewQuery,
  PrViewQueryVariables,
} from "./operations/pr-view.generated.js"
import type {
  RepoViewQuery,
  RepoViewQueryVariables
} from "./operations/repo-view.generated.js"

export type GraphqlVariables = Record<string, unknown>
type GraphqlDocument = string | DocumentNode
type QueryLike = GraphqlDocument | RequestDocument

export interface GraphqlTransport {
  execute<TData>(query: string, variables?: GraphqlVariables): Promise<TData>
}

export interface GraphqlClient {
  query<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
    query: GraphqlDocument,
    variables?: TVariables
  ): Promise<TData>
}

export type RepoViewInput = RepoViewQueryVariables
export type IssueCommentsListInput = IssueCommentsListQueryVariables
export type IssueListInput = IssueListQueryVariables
export type IssueViewInput = IssueViewQueryVariables
export type PrListInput = PrListQueryVariables
export type PrViewInput = PrViewQueryVariables

export type RepoViewData = {
  id: string
  name: string
  nameWithOwner: string
  isPrivate: boolean
  stargazerCount: number
  forkCount: number
  url: string
  defaultBranch: string | null
}

export type IssueViewData = {
  id: string
  number: number
  title: string
  state: string
  url: string
}

export type IssueListData = {
  items: Array<IssueViewData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type IssueCommentData = {
  id: string
  body: string
  authorLogin: string | null
  createdAt: string
  url: string
}

export type IssueCommentsListData = {
  items: Array<IssueCommentData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type PrViewData = {
  id: string
  number: number
  title: string
  state: string
  url: string
}

export type PrListData = {
  items: Array<PrViewData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export interface GithubClient extends GraphqlClient {
  fetchRepoView(input: RepoViewInput): Promise<RepoViewData>
  fetchIssueCommentsList(input: IssueCommentsListInput): Promise<IssueCommentsListData>
  fetchIssueList(input: IssueListInput): Promise<IssueListData>
  fetchIssueView(input: IssueViewInput): Promise<IssueViewData>
  fetchPrList(input: PrListInput): Promise<PrListData>
  fetchPrView(input: PrViewInput): Promise<PrViewData>
}

function assertRepoInput(input: RepoViewInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
}

function assertIssueInput(input: IssueViewInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.issueNumber) || input.issueNumber <= 0) {
    throw new Error("Issue number must be a positive integer")
  }
}

function assertIssueListInput(input: IssueListInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
}

function assertIssueCommentsListInput(input: IssueCommentsListInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.issueNumber) || input.issueNumber <= 0) {
    throw new Error("Issue number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
  if (input.after !== undefined && input.after !== null && typeof input.after !== "string") {
    throw new Error("After cursor must be a string")
  }
}

function assertPrInput(input: PrViewInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
}

function assertPrListInput(input: PrListInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
}

type SdkClients = {
  issueCommentsList: ReturnType<typeof getIssueCommentsListSdk>
  issueList: ReturnType<typeof getIssueListSdk>
  issue: ReturnType<typeof getIssueViewSdk>
  prList: ReturnType<typeof getPrListSdk>
  pr: ReturnType<typeof getPrViewSdk>
  repo: ReturnType<typeof getRepoViewSdk>
}

function createSdkClients(transport: GraphqlTransport): SdkClients {
  const client: Pick<GraphQLClient, "request"> = {
    request<TData, TVariables extends object = object>(
      documentOrOptions: RequestDocument | RequestOptions<TVariables, TData>,
      ...variablesAndRequestHeaders: unknown[]
    ): Promise<TData> {
      const options =
        typeof documentOrOptions === "object" && documentOrOptions !== null && "document" in documentOrOptions
          ? documentOrOptions
          : {
              document: documentOrOptions,
              variables: variablesAndRequestHeaders[0] as TVariables | undefined
            }

      const queryText = queryToString(options.document)
      assertQuery(queryText)
      return transport.execute<TData>(queryText, options.variables as GraphqlVariables)
    }
  }

  const graphqlRequestClient = client as GraphQLClient

  return {
    issueCommentsList: getIssueCommentsListSdk(graphqlRequestClient),
    issueList: getIssueListSdk(graphqlRequestClient),
    issue: getIssueViewSdk(graphqlRequestClient),
    prList: getPrListSdk(graphqlRequestClient),
    pr: getPrViewSdk(graphqlRequestClient),
    repo: getRepoViewSdk(graphqlRequestClient)
  }
}

async function runRepoView(sdk: SdkClients["repo"], input: RepoViewInput): Promise<RepoViewData> {
  assertRepoInput(input)

  const result: RepoViewQuery = await sdk.RepoView(input)
  if (!result.repository) {
    throw new Error("Repository not found")
  }

  return {
    id: result.repository.id,
    name: result.repository.name,
    nameWithOwner: result.repository.nameWithOwner,
    isPrivate: result.repository.isPrivate,
    stargazerCount: result.repository.stargazerCount,
    forkCount: result.repository.forkCount,
    url: result.repository.url,
    defaultBranch: result.repository.defaultBranchRef?.name ?? null
  }
}

async function runIssueView(sdk: SdkClients["issue"], input: IssueViewInput): Promise<IssueViewData> {
  assertIssueInput(input)

  const result: IssueViewQuery = await sdk.IssueView(input)
  const issue = result.repository?.issue
  if (!issue) {
    throw new Error("Issue not found")
  }

  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    state: issue.state,
    url: issue.url
  }
}

async function runIssueList(sdk: SdkClients["issueList"], input: IssueListInput): Promise<IssueListData> {
  assertIssueListInput(input)

  const result: IssueListQuery = await sdk.IssueList(input)
  const issues = result.repository?.issues
  if (!issues) {
    throw new Error("Issues not found")
  }

  return {
    items: (issues.nodes ?? []).flatMap((issue) =>
      issue
        ? [
            {
              id: issue.id,
              number: issue.number,
              title: issue.title,
              state: issue.state,
              url: issue.url
            }
          ]
        : []
    ),
    pageInfo: {
      endCursor: issues.pageInfo.endCursor ?? null,
      hasNextPage: issues.pageInfo.hasNextPage
    }
  }
}

async function runIssueCommentsList(
  sdk: SdkClients["issueCommentsList"],
  input: IssueCommentsListInput
): Promise<IssueCommentsListData> {
  assertIssueCommentsListInput(input)

  const result: IssueCommentsListQuery = await sdk.IssueCommentsList(input)
  const comments = result.repository?.issue?.comments
  if (!comments) {
    throw new Error("Issue comments not found")
  }

  return {
    items: (comments.nodes ?? []).flatMap((comment) =>
      comment
        ? [
            {
              id: comment.id,
              body: comment.body,
              authorLogin: comment.author?.login ?? null,
              createdAt: comment.createdAt,
              url: String(comment.url)
            }
          ]
        : []
    ),
    pageInfo: {
      endCursor: comments.pageInfo.endCursor ?? null,
      hasNextPage: comments.pageInfo.hasNextPage
    }
  }
}

async function runPrView(sdk: SdkClients["pr"], input: PrViewInput): Promise<PrViewData> {
  assertPrInput(input)

  const result: PrViewQuery = await sdk.PrView(input)
  const pr = result.repository?.pullRequest
  if (!pr) {
    throw new Error("Pull request not found")
  }

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    state: pr.state,
    url: pr.url
  }
}

async function runPrList(sdk: SdkClients["prList"], input: PrListInput): Promise<PrListData> {
  assertPrListInput(input)

  const result: PrListQuery = await sdk.PrList(input)
  const prs = result.repository?.pullRequests
  if (!prs) {
    throw new Error("Pull requests not found")
  }

  return {
    items: (prs.nodes ?? []).flatMap((pr) =>
      pr
        ? [
            {
              id: pr.id,
              number: pr.number,
              title: pr.title,
              state: pr.state,
              url: pr.url
            }
          ]
        : []
    ),
    pageInfo: {
      endCursor: prs.pageInfo.endCursor ?? null,
      hasNextPage: prs.pageInfo.hasNextPage
    }
  }
}

function queryToString(query: QueryLike): string {
  if (typeof query === "string") {
    return query
  }

  if (typeof query === "object" && query !== null && "kind" in query) {
    return print(query as DocumentNode)
  }

  return String(query)
}

function assertQuery(query: string): void {
  if (query.trim().length === 0) {
    throw new Error("GraphQL query must be non-empty")
  }
}

export function createGraphqlClient(transport: GraphqlTransport): GraphqlClient {
  return {
    async query<TData, TVariables extends GraphqlVariables = GraphqlVariables>(
      query: GraphqlDocument,
      variables?: TVariables
    ): Promise<TData> {
      const queryText = queryToString(query)
      assertQuery(queryText)
      return transport.execute<TData>(queryText, variables)
    }
  }
}

export function createGithubClient(transport: GraphqlTransport): GithubClient {
  const graphqlClient = createGraphqlClient(transport)
  const sdk = createSdkClients(transport)

  return {
    query: (query, variables) => graphqlClient.query(query, variables),
    fetchRepoView: (input) => runRepoView(sdk.repo, input),
    fetchIssueCommentsList: (input) => runIssueCommentsList(sdk.issueCommentsList, input),
    fetchIssueList: (input) => runIssueList(sdk.issueList, input),
    fetchIssueView: (input) => runIssueView(sdk.issue, input),
    fetchPrList: (input) => runPrList(sdk.prList, input),
    fetchPrView: (input) => runPrView(sdk.pr, input)
  }
}
