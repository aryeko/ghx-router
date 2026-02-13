import { print, type DocumentNode } from "graphql"
import type { GraphQLClient, RequestDocument, RequestOptions } from "graphql-request"

import {
  getSdk as getIssueViewSdk
} from "./operations/issue-view.generated.js"
import {
  getSdk as getPrViewSdk
} from "./operations/pr-view.generated.js"
import {
  getSdk as getRepoViewSdk
} from "./operations/repo-view.generated.js"
import type {
  IssueViewQuery,
  IssueViewQueryVariables,
} from "./operations/issue-view.generated.js"
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
export type IssueViewInput = IssueViewQueryVariables
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

export type PrViewData = {
  id: string
  number: number
  title: string
  state: string
  url: string
}

export interface GithubClient extends GraphqlClient {
  fetchRepoView(input: RepoViewInput): Promise<RepoViewData>
  fetchIssueView(input: IssueViewInput): Promise<IssueViewData>
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

function assertPrInput(input: PrViewInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
}

type SdkClients = {
  issue: ReturnType<typeof getIssueViewSdk>
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
    issue: getIssueViewSdk(graphqlRequestClient),
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
    fetchIssueView: (input) => runIssueView(sdk.issue, input),
    fetchPrView: (input) => runPrView(sdk.pr, input)
  }
}
