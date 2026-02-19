import {
  asRecord,
  assertPrCommentsListInput,
  assertReplyToReviewThreadInput,
  assertReviewThreadInput,
} from "../assertions.js"
import type { GraphqlClient, GraphqlVariables } from "../transport.js"
import type {
  PrCommentsListData,
  PrCommentsListInput,
  PrReviewThreadCommentData,
  PrReviewThreadData,
  ReplyToReviewThreadInput,
  ReviewThreadMutationData,
  ReviewThreadMutationInput,
} from "../types.js"

const PR_COMMENTS_LIST_QUERY = `
  query PrCommentsList($owner: String!, $name: String!, $prNumber: Int!, $first: Int!, $after: String) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $prNumber) {
        reviewThreads(first: $first, after: $after) {
          edges {
            cursor
            node {
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

const MAX_PR_REVIEW_THREAD_SCAN_PAGES = 5

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
    url: typeof url === "string" ? url : String(url ?? ""),
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
      .flatMap((comment) => (comment ? [comment] : [])),
  }
}

export async function runPrCommentsList(
  graphqlClient: GraphqlClient,
  input: PrCommentsListInput,
): Promise<PrCommentsListData> {
  assertPrCommentsListInput(input)

  const unresolvedOnly = input.unresolvedOnly ?? true
  const includeOutdated = input.includeOutdated ?? true

  const filteredThreads: Array<{ thread: PrReviewThreadData; cursor: string | null }> = []
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
      after: sourceEndCursor,
    })

    const repository = asRecord(asRecord(result)?.repository)
    const pullRequest = asRecord(repository?.pullRequest)
    const reviewThreads = asRecord(pullRequest?.reviewThreads)
    if (!reviewThreads) {
      throw new Error("Pull request review threads not found")
    }

    const pageInfo = asRecord(reviewThreads.pageInfo)
    const threadEdges = Array.isArray(reviewThreads.edges)
      ? reviewThreads.edges
          .map((edge) => {
            const edgeRecord = asRecord(edge)
            if (!edgeRecord) {
              return null
            }

            return {
              cursor: typeof edgeRecord.cursor === "string" ? edgeRecord.cursor : null,
              node: edgeRecord.node,
            }
          })
          .flatMap((edge) => (edge ? [edge] : []))
      : []

    const threadNodes =
      threadEdges.length > 0
        ? threadEdges
        : Array.isArray(reviewThreads.nodes)
          ? reviewThreads.nodes.map((node) => ({ cursor: null, node }))
          : []

    pagesScanned += 1
    sourceItemsScanned += threadNodes.length

    for (const threadNode of threadNodes) {
      const normalized = normalizePrReviewThread(threadNode.node)
      if (!normalized) {
        continue
      }

      if (unresolvedOnly && normalized.isResolved) {
        continue
      }

      if (unresolvedOnly && !includeOutdated && normalized.isOutdated) {
        continue
      }

      filteredThreads.push({ thread: normalized, cursor: threadNode.cursor })
    }

    sourceHasNextPage = Boolean(pageInfo?.hasNextPage)
    sourceEndCursor = typeof pageInfo?.endCursor === "string" ? pageInfo.endCursor : null

    if (!sourceHasNextPage) {
      break
    }
  }

  const hasBufferedFilteredItems = filteredThreads.length > input.first
  const returnedThreads = filteredThreads.slice(0, input.first)
  const endCursor =
    returnedThreads.length > 0
      ? (returnedThreads[returnedThreads.length - 1]?.cursor ?? sourceEndCursor)
      : sourceEndCursor
  const scanTruncated = sourceHasNextPage && pagesScanned >= MAX_PR_REVIEW_THREAD_SCAN_PAGES

  return {
    items: returnedThreads.map((entry) => entry.thread),
    pageInfo: {
      hasNextPage: hasBufferedFilteredItems || sourceHasNextPage,
      endCursor: hasBufferedFilteredItems || sourceHasNextPage ? endCursor : null,
    },
    filterApplied: {
      unresolvedOnly,
      includeOutdated,
    },
    scan: {
      pagesScanned,
      sourceItemsScanned,
      scanTruncated,
    },
  }
}

function parseReviewThreadMutationResult(
  result: unknown,
  mutationKey: string,
): ReviewThreadMutationData {
  const root = asRecord(result)
  const mutation = asRecord(root?.[mutationKey])
  const thread = asRecord(mutation?.thread)
  if (!thread || typeof thread.id !== "string") {
    throw new Error("Review thread mutation failed")
  }

  return {
    id: thread.id,
    isResolved: Boolean(thread.isResolved),
  }
}

export async function runReplyToReviewThread(
  graphqlClient: GraphqlClient,
  input: ReplyToReviewThreadInput,
): Promise<ReviewThreadMutationData> {
  assertReplyToReviewThreadInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(PR_COMMENT_REPLY_MUTATION, {
    threadId: input.threadId,
    body: input.body,
  })
  const root = asRecord(result)
  const mutation = asRecord(root?.addPullRequestReviewThreadReply)
  const comment = asRecord(mutation?.comment)
  if (!comment || typeof comment.id !== "string") {
    throw new Error("Review thread mutation failed")
  }

  const threadStateResult = await graphqlClient.query<unknown, GraphqlVariables>(
    REVIEW_THREAD_STATE_QUERY,
    {
      threadId: input.threadId,
    },
  )
  const threadNode = asRecord(asRecord(threadStateResult)?.node)
  if (!threadNode || typeof threadNode.id !== "string") {
    throw new Error("Review thread state lookup failed")
  }

  return {
    id: input.threadId,
    isResolved: Boolean(threadNode.isResolved),
  }
}

export async function runResolveReviewThread(
  graphqlClient: GraphqlClient,
  input: ReviewThreadMutationInput,
): Promise<ReviewThreadMutationData> {
  assertReviewThreadInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(PR_COMMENT_RESOLVE_MUTATION, {
    threadId: input.threadId,
  })
  return parseReviewThreadMutationResult(result, "resolveReviewThread")
}

export async function runUnresolveReviewThread(
  graphqlClient: GraphqlClient,
  input: ReviewThreadMutationInput,
): Promise<ReviewThreadMutationData> {
  assertReviewThreadInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(
    PR_COMMENT_UNRESOLVE_MUTATION,
    {
      threadId: input.threadId,
    },
  )
  return parseReviewThreadMutationResult(result, "unresolveReviewThread")
}
