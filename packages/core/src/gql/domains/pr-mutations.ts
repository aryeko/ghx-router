import {
  asRecord,
  assertPrCommentsListInput,
  assertReplyToReviewThreadInput,
  assertReviewThreadInput,
} from "../assertions.js"
import { getSdk as getPrCommentReplySdk } from "../operations/pr-comment-reply.generated.js"
import { getSdk as getPrCommentResolveSdk } from "../operations/pr-comment-resolve.generated.js"
import { getSdk as getPrCommentUnresolveSdk } from "../operations/pr-comment-unresolve.generated.js"
import { getSdk as getPrCommentsListSdk } from "../operations/pr-comments-list.generated.js"
import { getSdk as getPrNodeIdSdk } from "../operations/pr-node-id.generated.js"
import {
  getSdk as getPrReviewSubmitSdk,
  type PrReviewSubmitMutationVariables,
} from "../operations/pr-review-submit.generated.js"
import { getSdk as getReviewThreadStateSdk } from "../operations/review-thread-state.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  DraftComment,
  PrCommentsListData,
  PrCommentsListInput,
  PrReviewSubmitData,
  PrReviewSubmitInput,
  PrReviewThreadCommentData,
  PrReviewThreadData,
  ReplyToReviewThreadData,
  ReplyToReviewThreadInput,
  ReviewThreadMutationData,
  ReviewThreadMutationInput,
} from "../types.js"

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
  transport: GraphqlTransport,
  input: PrCommentsListInput,
): Promise<PrCommentsListData> {
  assertPrCommentsListInput(input)

  const unresolvedOnly = input.unresolvedOnly ?? true
  const includeOutdated = input.includeOutdated ?? true

  const sdk = getPrCommentsListSdk(createGraphqlRequestClient(transport))

  const filteredThreads: Array<{ thread: PrReviewThreadData; cursor: string | null }> = []
  let sourceEndCursor: string | null = input.after ?? null
  let sourceHasNextPage = false
  let pagesScanned = 0
  let sourceItemsScanned = 0

  while (pagesScanned < MAX_PR_REVIEW_THREAD_SCAN_PAGES && filteredThreads.length < input.first) {
    const result = await sdk.PrCommentsList({
      owner: input.owner,
      name: input.name,
      prNumber: input.prNumber,
      first: input.first,
      after: sourceEndCursor,
    })

    const repository = asRecord(result.repository)
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
  transport: GraphqlTransport,
  input: ReplyToReviewThreadInput,
): Promise<ReplyToReviewThreadData> {
  assertReplyToReviewThreadInput(input)

  const client = createGraphqlRequestClient(transport)
  const replyResult = await getPrCommentReplySdk(client).PrCommentReply({
    threadId: input.threadId,
    body: input.body,
  })
  const mutation = asRecord(replyResult.addPullRequestReviewThreadReply)
  const comment = asRecord(mutation?.comment)
  if (!comment || typeof comment.id !== "string") {
    throw new Error("Review thread mutation failed")
  }

  const threadStateResult = await getReviewThreadStateSdk(client).ReviewThreadState({
    threadId: input.threadId,
  })
  const threadNode = asRecord(threadStateResult.node)
  if (!threadNode || typeof threadNode.id !== "string") {
    throw new Error("Review thread state lookup failed")
  }

  return {
    id: input.threadId,
    isResolved: Boolean(threadNode.isResolved),
    commentId: comment.id,
    commentUrl: typeof comment.url === "string" ? comment.url : "",
  }
}

export async function runResolveReviewThread(
  transport: GraphqlTransport,
  input: ReviewThreadMutationInput,
): Promise<ReviewThreadMutationData> {
  assertReviewThreadInput(input)

  const result = await getPrCommentResolveSdk(
    createGraphqlRequestClient(transport),
  ).PrCommentResolve({
    threadId: input.threadId,
  })
  return parseReviewThreadMutationResult(result, "resolveReviewThread")
}

export async function runUnresolveReviewThread(
  transport: GraphqlTransport,
  input: ReviewThreadMutationInput,
): Promise<ReviewThreadMutationData> {
  assertReviewThreadInput(input)

  const result = await getPrCommentUnresolveSdk(
    createGraphqlRequestClient(transport),
  ).PrCommentUnresolve({
    threadId: input.threadId,
  })
  return parseReviewThreadMutationResult(result, "unresolveReviewThread")
}

function assertPrReviewSubmitInput(input: PrReviewSubmitInput): void {
  if (input.owner.trim().length === 0 || input.name.trim().length === 0) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!input.event || typeof input.event !== "string") {
    throw new Error("Review event is required")
  }
}

export async function runSubmitPrReview(
  transport: GraphqlTransport,
  input: PrReviewSubmitInput,
): Promise<PrReviewSubmitData> {
  assertPrReviewSubmitInput(input)

  const client = createGraphqlRequestClient(transport)
  const prIdResult = await getPrNodeIdSdk(client).PrNodeId({
    owner: input.owner,
    name: input.name,
    prNumber: input.prNumber,
  })

  const pullRequestId = prIdResult.repository?.pullRequest?.id
  if (!pullRequestId) {
    throw new Error("Failed to retrieve pull request ID")
  }

  const threads = input.comments
    ? input.comments.map((comment: DraftComment) => ({
        path: comment.path,
        body: comment.body,
        line: comment.line,
        ...(comment.side ? { side: comment.side } : {}),
        ...(comment.startLine ? { startLine: comment.startLine } : {}),
        ...(comment.startSide ? { startSide: comment.startSide } : {}),
      }))
    : []

  const result = await getPrReviewSubmitSdk(client).PrReviewSubmit({
    pullRequestId,
    event: input.event as PrReviewSubmitMutationVariables["event"],
    ...(input.body === undefined ? {} : { body: input.body }),
    ...(threads.length === 0 ? {} : { threads }),
  })

  const review = asRecord(asRecord(result.addPullRequestReview)?.pullRequestReview)
  if (!review || typeof review.id !== "string") {
    throw new Error("Failed to parse pull request review response")
  }

  return {
    id: review.id,
    state: typeof review.state === "string" ? review.state : "",
    url: typeof review.url === "string" ? review.url : "",
    body: typeof review.body === "string" ? review.body : null,
  }
}
