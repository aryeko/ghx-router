import {
  assertPrDiffListFilesInput,
  assertPrInput,
  assertPrListInput,
  assertPrReviewsListInput,
} from "../assertions.js"
import type { PrDiffListFilesQuery } from "../operations/pr-diff-list-files.generated.js"
import { getSdk as getPrDiffListFilesSdk } from "../operations/pr-diff-list-files.generated.js"
import type { PrListQuery } from "../operations/pr-list.generated.js"
import { getSdk as getPrListSdk } from "../operations/pr-list.generated.js"
import { getSdk as getPrMergeStatusSdk } from "../operations/pr-merge-status.generated.js"
import type { PrReviewsListQuery } from "../operations/pr-reviews-list.generated.js"
import { getSdk as getPrReviewsListSdk } from "../operations/pr-reviews-list.generated.js"
import type { PrViewQuery } from "../operations/pr-view.generated.js"
import { getSdk as getPrViewSdk } from "../operations/pr-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  PrDiffListFilesData,
  PrDiffListFilesInput,
  PrListData,
  PrListInput,
  PrMergeStatusData,
  PrMergeStatusInput,
  PrReviewsListData,
  PrReviewsListInput,
  PrViewData,
  PrViewInput,
} from "../types.js"

export async function runPrView(
  transport: GraphqlTransport,
  input: PrViewInput,
): Promise<PrViewData> {
  assertPrInput(input)

  const sdk = getPrViewSdk(createGraphqlRequestClient(transport))
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
    url: pr.url,
    body: pr.body ?? "",
    labels: (pr.labels?.nodes ?? []).flatMap((n) => (n ? [n.name] : [])),
  }
}

export async function runPrList(
  transport: GraphqlTransport,
  input: PrListInput,
): Promise<PrListData> {
  assertPrListInput(input)

  const sdk = getPrListSdk(createGraphqlRequestClient(transport))
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
              url: pr.url,
            },
          ]
        : [],
    ),
    pageInfo: {
      endCursor: prs.pageInfo.endCursor ?? null,
      hasNextPage: prs.pageInfo.hasNextPage,
    },
  }
}

export async function runPrReviewsList(
  transport: GraphqlTransport,
  input: PrReviewsListInput,
): Promise<PrReviewsListData> {
  assertPrReviewsListInput(input)

  const sdk = getPrReviewsListSdk(createGraphqlRequestClient(transport))
  const result: PrReviewsListQuery = await sdk.PrReviewsList(input)
  const reviews = result.repository?.pullRequest?.reviews
  if (!reviews) {
    throw new Error("Pull request reviews not found")
  }

  return {
    items: (reviews.nodes ?? []).flatMap((review) =>
      review
        ? [
            {
              id: review.id,
              authorLogin: review.author?.login ?? null,
              body: review.body,
              state: review.state,
              submittedAt: review.submittedAt ?? null,
              url: review.url,
              commitOid: review.commit?.oid ?? null,
            },
          ]
        : [],
    ),
    pageInfo: {
      endCursor: reviews.pageInfo.endCursor ?? null,
      hasNextPage: reviews.pageInfo.hasNextPage,
    },
  }
}

export async function runPrDiffListFiles(
  transport: GraphqlTransport,
  input: PrDiffListFilesInput,
): Promise<PrDiffListFilesData> {
  assertPrDiffListFilesInput(input)

  const sdk = getPrDiffListFilesSdk(createGraphqlRequestClient(transport))
  const result: PrDiffListFilesQuery = await sdk.PrDiffListFiles(input)
  const files = result.repository?.pullRequest?.files
  if (!files) {
    throw new Error("Pull request files not found")
  }

  return {
    items: (files.nodes ?? []).flatMap((file) =>
      file
        ? [
            {
              path: file.path,
              additions: file.additions,
              deletions: file.deletions,
            },
          ]
        : [],
    ),
    pageInfo: {
      endCursor: files.pageInfo.endCursor ?? null,
      hasNextPage: files.pageInfo.hasNextPage,
    },
  }
}

export async function runPrMergeStatus(
  transport: GraphqlTransport,
  input: PrMergeStatusInput,
): Promise<PrMergeStatusData> {
  assertPrInput({ owner: input.owner, name: input.name, prNumber: input.prNumber })

  const result = await getPrMergeStatusSdk(createGraphqlRequestClient(transport)).PrMergeStatus({
    owner: input.owner,
    name: input.name,
    prNumber: input.prNumber,
  })

  const pr = result.repository?.pullRequest
  if (!pr) {
    throw new Error("Pull request not found")
  }

  return {
    mergeable: pr.mergeable ?? null,
    mergeStateStatus: pr.mergeStateStatus ?? null,
    reviewDecision: pr.reviewDecision ?? null,
    isDraft: pr.isDraft,
    state: pr.state,
  }
}
