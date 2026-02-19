import {
  assertIssueCommentsListInput,
  assertIssueInput,
  assertIssueListInput,
} from "../assertions.js"
import type { IssueCommentsListQuery } from "../operations/issue-comments-list.generated.js"
import { getSdk as getIssueCommentsListSdk } from "../operations/issue-comments-list.generated.js"
import type { IssueListQuery } from "../operations/issue-list.generated.js"
import { getSdk as getIssueListSdk } from "../operations/issue-list.generated.js"
import type { IssueViewQuery } from "../operations/issue-view.generated.js"
import { getSdk as getIssueViewSdk } from "../operations/issue-view.generated.js"
import type { GraphqlTransport } from "../transport.js"
import { createGraphqlRequestClient } from "../transport.js"
import type {
  IssueCommentsListData,
  IssueCommentsListInput,
  IssueListData,
  IssueListInput,
  IssueViewData,
  IssueViewInput,
} from "../types.js"

export async function runIssueView(
  transport: GraphqlTransport,
  input: IssueViewInput,
): Promise<IssueViewData> {
  assertIssueInput(input)

  const sdk = getIssueViewSdk(createGraphqlRequestClient(transport))
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
    url: issue.url,
    body: issue.body ?? "",
    labels: (issue.labels?.nodes ?? []).flatMap((n) => (n ? [n.name] : [])),
  }
}

export async function runIssueList(
  transport: GraphqlTransport,
  input: IssueListInput,
): Promise<IssueListData> {
  assertIssueListInput(input)

  const sdk = getIssueListSdk(createGraphqlRequestClient(transport))
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
              url: issue.url,
            },
          ]
        : [],
    ),
    pageInfo: {
      endCursor: issues.pageInfo.endCursor ?? null,
      hasNextPage: issues.pageInfo.hasNextPage,
    },
  }
}

export async function runIssueCommentsList(
  transport: GraphqlTransport,
  input: IssueCommentsListInput,
): Promise<IssueCommentsListData> {
  assertIssueCommentsListInput(input)

  const sdk = getIssueCommentsListSdk(createGraphqlRequestClient(transport))
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
              url: String(comment.url),
            },
          ]
        : [],
    ),
    pageInfo: {
      endCursor: comments.pageInfo.endCursor ?? null,
      hasNextPage: comments.pageInfo.hasNextPage,
    },
  }
}
