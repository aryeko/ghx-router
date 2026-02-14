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
  getSdk as getPrDiffListFilesSdk
} from "./operations/pr-diff-list-files.generated.js"
import {
  getSdk as getPrReviewsListSdk
} from "./operations/pr-reviews-list.generated.js"
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
  PrDiffListFilesQuery,
  PrDiffListFilesQueryVariables,
} from "./operations/pr-diff-list-files.generated.js"
import type {
  PrReviewsListQuery,
  PrReviewsListQueryVariables,
} from "./operations/pr-reviews-list.generated.js"
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
export type PrReviewsListInput = PrReviewsListQueryVariables
export type PrDiffListFilesInput = PrDiffListFilesQueryVariables

export type PrCommentsListInput = {
  owner: string
  name: string
  prNumber: number
  first: number
  after?: string | null
  unresolvedOnly?: boolean
  includeOutdated?: boolean
}

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

export type PrReviewThreadCommentData = {
  id: string
  authorLogin: string | null
  body: string
  createdAt: string
  url: string
}

export type PrReviewThreadData = {
  id: string
  path: string | null
  line: number | null
  startLine: number | null
  diffSide: string | null
  subjectType: string | null
  isResolved: boolean
  isOutdated: boolean
  viewerCanReply: boolean
  viewerCanResolve: boolean
  viewerCanUnresolve: boolean
  resolvedByLogin: string | null
  comments: Array<PrReviewThreadCommentData>
}

export type PrCommentsListData = {
  items: Array<PrReviewThreadData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
  filterApplied: {
    unresolvedOnly: boolean
    includeOutdated: boolean
  }
  scan: {
    pagesScanned: number
    sourceItemsScanned: number
    scanTruncated: boolean
  }
}

export type PrReviewData = {
  id: string
  authorLogin: string | null
  body: string
  state: string
  submittedAt: string | null
  url: string
  commitOid: string | null
}

export type PrReviewsListData = {
  items: Array<PrReviewData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type PrDiffFileData = {
  path: string
  additions: number
  deletions: number
}

export type PrDiffListFilesData = {
  items: Array<PrDiffFileData>
  pageInfo: {
    endCursor: string | null
    hasNextPage: boolean
  }
}

export type ReviewThreadMutationInput = {
  threadId: string
}

export type ReplyToReviewThreadInput = ReviewThreadMutationInput & {
  body: string
}

export type ReviewThreadMutationData = {
  id: string
  isResolved: boolean
}

export interface GithubClient extends GraphqlClient {
  fetchRepoView(input: RepoViewInput): Promise<RepoViewData>
  fetchIssueCommentsList(input: IssueCommentsListInput): Promise<IssueCommentsListData>
  fetchIssueList(input: IssueListInput): Promise<IssueListData>
  fetchIssueView(input: IssueViewInput): Promise<IssueViewData>
  fetchPrList(input: PrListInput): Promise<PrListData>
  fetchPrView(input: PrViewInput): Promise<PrViewData>
  fetchPrCommentsList(input: PrCommentsListInput): Promise<PrCommentsListData>
  fetchPrReviewsList(input: PrReviewsListInput): Promise<PrReviewsListData>
  fetchPrDiffListFiles(input: PrDiffListFilesInput): Promise<PrDiffListFilesData>
  replyToReviewThread(input: ReplyToReviewThreadInput): Promise<ReviewThreadMutationData>
  resolveReviewThread(input: ReviewThreadMutationInput): Promise<ReviewThreadMutationData>
  unresolveReviewThread(input: ReviewThreadMutationInput): Promise<ReviewThreadMutationData>
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

function assertPrReviewsListInput(input: PrReviewsListInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
}

function assertPrDiffListFilesInput(input: PrDiffListFilesInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
}

function assertPrCommentsListInput(input: PrCommentsListInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
  if (input.after !== undefined && input.after !== null && typeof input.after !== "string") {
    throw new Error("After cursor must be a string")
  }
}

const PR_COMMENTS_LIST_QUERY = `
  query PrCommentsList($owner: String!, $name: String!, $prNumber: Int!, $first: Int!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $prNumber) {
        reviewThreads(first: $first, after: $after) {
          nodes {
            id
            path
            line
            startLine
            diffSide
            subjectType
            isResolved
            isOutdated
            viewerCanReply
            viewerCanResolve
            viewerCanUnresolve
            resolvedBy {
              login
            }
            comments(first: 20) {
              nodes {
                id
                body
                createdAt
                url
                author {
                  login
                }
              }
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
`

const PR_COMMENT_REPLY_MUTATION = `
  mutation PrCommentReply($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
      comment {
        id
      }
    }
  }
`

const PR_COMMENT_RESOLVE_MUTATION = `
  mutation PrCommentResolve($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
      }
    }
  }
`

const PR_COMMENT_UNRESOLVE_MUTATION = `
  mutation PrCommentUnresolve($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
      }
    }
  }
`

const REVIEW_THREAD_STATE_QUERY = `
  query ReviewThreadState($threadId: ID!) {
    node(id: $threadId) {
      ... on PullRequestReviewThread {
        id
        isResolved
      }
    }
  }
`

type SdkClients = {
  issueCommentsList: ReturnType<typeof getIssueCommentsListSdk>
  issueList: ReturnType<typeof getIssueListSdk>
  issue: ReturnType<typeof getIssueViewSdk>
  prDiffListFiles: ReturnType<typeof getPrDiffListFilesSdk>
  prList: ReturnType<typeof getPrListSdk>
  prReviewsList: ReturnType<typeof getPrReviewsListSdk>
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
    prDiffListFiles: getPrDiffListFilesSdk(graphqlRequestClient),
    prList: getPrListSdk(graphqlRequestClient),
    prReviewsList: getPrReviewsListSdk(graphqlRequestClient),
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

async function runPrReviewsList(
  sdk: SdkClients["prReviewsList"],
  input: PrReviewsListInput
): Promise<PrReviewsListData> {
  assertPrReviewsListInput(input)

  const result: PrReviewsListQuery = await sdk.PrReviewsList(input)
  const reviews = result.repository?.pullRequest?.reviews
  if (!reviews) {
    throw new Error("Pull request reviews not found")
  }

  return {
    items: (reviews.nodes ?? []).flatMap((review) =>
      review
        ? [{
            id: review.id,
            authorLogin: review.author?.login ?? null,
            body: review.body,
            state: review.state,
            submittedAt: review.submittedAt ?? null,
            url: review.url,
            commitOid: review.commit?.oid ?? null
          }]
        : []
    ),
    pageInfo: {
      endCursor: reviews.pageInfo.endCursor ?? null,
      hasNextPage: reviews.pageInfo.hasNextPage
    }
  }
}

async function runPrDiffListFiles(
  sdk: SdkClients["prDiffListFiles"],
  input: PrDiffListFilesInput
): Promise<PrDiffListFilesData> {
  assertPrDiffListFilesInput(input)

  const result: PrDiffListFilesQuery = await sdk.PrDiffListFiles(input)
  const files = result.repository?.pullRequest?.files
  if (!files) {
    throw new Error("Pull request files not found")
  }

  return {
    items: (files.nodes ?? []).flatMap((file) =>
      file
        ? [{
            path: file.path,
            additions: file.additions,
            deletions: file.deletions
          }]
        : []
    ),
    pageInfo: {
      endCursor: files.pageInfo.endCursor ?? null,
      hasNextPage: files.pageInfo.hasNextPage
    }
  }
}

const MAX_PR_REVIEW_THREAD_SCAN_PAGES = 5

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizePrReviewThreadComment(comment: unknown): PrReviewThreadCommentData | null {
  const commentRecord = asRecord(comment)
  if (!commentRecord || typeof commentRecord.id !== "string") {
    return null
  }

  const author = asRecord(commentRecord.author)
  const url = commentRecord.url

  return {
    id: commentRecord.id,
    authorLogin: typeof author?.login === "string" ? author.login : null,
    body: typeof commentRecord.body === "string" ? commentRecord.body : "",
    createdAt: typeof commentRecord.createdAt === "string" ? commentRecord.createdAt : "",
    url: typeof url === "string" ? url : String(url ?? "")
  }
}

function normalizePrReviewThread(thread: unknown): PrReviewThreadData | null {
  const threadRecord = asRecord(thread)
  if (!threadRecord || typeof threadRecord.id !== "string") {
    return null
  }

  const comments = asRecord(threadRecord.comments)
  const commentNodes = Array.isArray(comments?.nodes) ? comments.nodes : []
  const resolvedBy = asRecord(threadRecord.resolvedBy)

  return {
    id: threadRecord.id,
    path: typeof threadRecord.path === "string" ? threadRecord.path : null,
    line: typeof threadRecord.line === "number" ? threadRecord.line : null,
    startLine: typeof threadRecord.startLine === "number" ? threadRecord.startLine : null,
    diffSide: typeof threadRecord.diffSide === "string" ? threadRecord.diffSide : null,
    subjectType: typeof threadRecord.subjectType === "string" ? threadRecord.subjectType : null,
    isResolved: Boolean(threadRecord.isResolved),
    isOutdated: Boolean(threadRecord.isOutdated),
    viewerCanReply: Boolean(threadRecord.viewerCanReply),
    viewerCanResolve: Boolean(threadRecord.viewerCanResolve),
    viewerCanUnresolve: Boolean(threadRecord.viewerCanUnresolve),
    resolvedByLogin: typeof resolvedBy?.login === "string" ? resolvedBy.login : null,
    comments: commentNodes
      .map((comment) => normalizePrReviewThreadComment(comment))
      .flatMap((comment) => (comment ? [comment] : []))
  }
}

async function runPrCommentsList(
  graphqlClient: GraphqlClient,
  input: PrCommentsListInput
): Promise<PrCommentsListData> {
  assertPrCommentsListInput(input)

  const unresolvedOnly = input.unresolvedOnly ?? false
  const includeOutdated = input.includeOutdated ?? true

  const filteredThreads: PrReviewThreadData[] = []
  let sourceEndCursor: string | null = input.after ?? null
  let sourceHasNextPage = false
  let pagesScanned = 0
  let sourceItemsScanned = 0

  while (pagesScanned < MAX_PR_REVIEW_THREAD_SCAN_PAGES && filteredThreads.length < input.first) {
    const result = await graphqlClient.query<unknown, GraphqlVariables>(PR_COMMENTS_LIST_QUERY, {
      owner: input.owner,
      name: input.name,
      prNumber: input.prNumber,
      first: input.first,
      after: sourceEndCursor
    })

    const repository = asRecord(asRecord(result)?.repository)
    const pullRequest = asRecord(repository?.pullRequest)
    const reviewThreads = asRecord(pullRequest?.reviewThreads)
    if (!reviewThreads) {
      throw new Error("Pull request review threads not found")
    }

    const pageInfo = asRecord(reviewThreads.pageInfo)
    const threadNodes = Array.isArray(reviewThreads.nodes) ? reviewThreads.nodes : []

    pagesScanned += 1
    sourceItemsScanned += threadNodes.length

    for (const threadNode of threadNodes) {
      const normalized = normalizePrReviewThread(threadNode)
      if (!normalized) {
        continue
      }

      if (unresolvedOnly && normalized.isResolved) {
        continue
      }

      if (!includeOutdated && normalized.isOutdated) {
        continue
      }

      filteredThreads.push(normalized)
    }

    sourceHasNextPage = Boolean(pageInfo?.hasNextPage)
    sourceEndCursor = typeof pageInfo?.endCursor === "string" ? pageInfo.endCursor : null

    if (!sourceHasNextPage) {
      break
    }
  }

  const hasBufferedFilteredItems = filteredThreads.length > input.first
  const scanTruncated = sourceHasNextPage && pagesScanned >= MAX_PR_REVIEW_THREAD_SCAN_PAGES

  return {
    items: filteredThreads.slice(0, input.first),
    pageInfo: {
      hasNextPage: hasBufferedFilteredItems || sourceHasNextPage,
      endCursor: hasBufferedFilteredItems || sourceHasNextPage ? sourceEndCursor : null
    },
    filterApplied: {
      unresolvedOnly,
      includeOutdated
    },
    scan: {
      pagesScanned,
      sourceItemsScanned,
      scanTruncated
    }
  }
}

function assertReviewThreadInput(input: ReviewThreadMutationInput): void {
  if (input.threadId.trim().length === 0) {
    throw new Error("Review thread id is required")
  }
}

function assertReplyToReviewThreadInput(input: ReplyToReviewThreadInput): void {
  assertReviewThreadInput(input)
  if (input.body.trim().length === 0) {
    throw new Error("Reply body is required")
  }
}

function parseReviewThreadMutationResult(result: unknown, mutationKey: string): ReviewThreadMutationData {
  const root = asRecord(result)
  const mutation = asRecord(root?.[mutationKey])
  const thread = asRecord(mutation?.thread)
  if (!thread || typeof thread.id !== "string") {
    throw new Error("Review thread mutation failed")
  }

  return {
    id: thread.id,
    isResolved: Boolean(thread.isResolved)
  }
}

async function runReplyToReviewThread(
  graphqlClient: GraphqlClient,
  input: ReplyToReviewThreadInput
): Promise<ReviewThreadMutationData> {
  assertReplyToReviewThreadInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(PR_COMMENT_REPLY_MUTATION, {
    threadId: input.threadId,
    body: input.body
  })
  const root = asRecord(result)
  const mutation = asRecord(root?.addPullRequestReviewThreadReply)
  const comment = asRecord(mutation?.comment)
  if (!comment || typeof comment.id !== "string") {
    throw new Error("Review thread mutation failed")
  }

  const threadStateResult = await graphqlClient.query<unknown, GraphqlVariables>(REVIEW_THREAD_STATE_QUERY, {
    threadId: input.threadId
  })
  const threadNode = asRecord(asRecord(threadStateResult)?.node)
  if (!threadNode || typeof threadNode.id !== "string") {
    throw new Error("Review thread state lookup failed")
  }

  return {
    id: input.threadId,
    isResolved: Boolean(threadNode.isResolved)
  }
}

async function runResolveReviewThread(
  graphqlClient: GraphqlClient,
  input: ReviewThreadMutationInput
): Promise<ReviewThreadMutationData> {
  assertReviewThreadInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(PR_COMMENT_RESOLVE_MUTATION, {
    threadId: input.threadId
  })
  return parseReviewThreadMutationResult(result, "resolveReviewThread")
}

async function runUnresolveReviewThread(
  graphqlClient: GraphqlClient,
  input: ReviewThreadMutationInput
): Promise<ReviewThreadMutationData> {
  assertReviewThreadInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(PR_COMMENT_UNRESOLVE_MUTATION, {
    threadId: input.threadId
  })
  return parseReviewThreadMutationResult(result, "unresolveReviewThread")
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
    fetchPrView: (input) => runPrView(sdk.pr, input),
    fetchPrCommentsList: (input) => runPrCommentsList(graphqlClient, input),
    fetchPrReviewsList: (input) => runPrReviewsList(sdk.prReviewsList, input),
    fetchPrDiffListFiles: (input) => runPrDiffListFiles(sdk.prDiffListFiles, input),
    replyToReviewThread: (input) => runReplyToReviewThread(graphqlClient, input),
    resolveReviewThread: (input) => runResolveReviewThread(graphqlClient, input),
    unresolveReviewThread: (input) => runUnresolveReviewThread(graphqlClient, input)
  }
}
