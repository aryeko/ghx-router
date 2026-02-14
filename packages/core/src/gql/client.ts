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

export type IssueCreateInput = {
  owner: string
  name: string
  title: string
  body?: string
}

export type IssueUpdateInput = {
  issueId: string
  title?: string
  body?: string
}

export type IssueMutationInput = {
  issueId: string
}

export type IssueLabelsUpdateInput = {
  issueId: string
  labels: string[]
}

export type IssueAssigneesUpdateInput = {
  issueId: string
  assignees: string[]
}

export type IssueMilestoneSetInput = {
  issueId: string
  milestoneNumber: number | null
}

export type IssueCommentCreateInput = {
  issueId: string
  body: string
}

export type IssueLinkedPrsListInput = {
  owner: string
  name: string
  issueNumber: number
}

export type IssueRelationsGetInput = IssueLinkedPrsListInput

export type IssueParentSetInput = {
  issueId: string
  parentIssueId: string
}

export type IssueParentRemoveInput = {
  issueId: string
}

export type IssueBlockedByInput = {
  issueId: string
  blockedByIssueId: string
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

export type IssueMutationData = {
  id: string
  number: number
  title?: string
  state?: string
  url?: string
  closed?: boolean
  reopened?: boolean
  deleted?: boolean
}

export type IssueLabelsUpdateData = {
  id: string
  labels: string[]
}

export type IssueAssigneesUpdateData = {
  id: string
  assignees: string[]
}

export type IssueMilestoneSetData = {
  id: string
  milestoneNumber: number | null
}

export type IssueCommentCreateData = {
  id: string
  body: string
  url: string
}

export type IssueLinkedPrData = {
  id: string
  number: number
  title: string
  state: string
  url: string
}

export type IssueLinkedPrsListData = {
  items: Array<IssueLinkedPrData>
}

export type IssueRelationNodeData = {
  id: string
  number: number
}

export type IssueRelationsGetData = {
  issue: IssueRelationNodeData
  parent: IssueRelationNodeData | null
  children: Array<IssueRelationNodeData>
  blockedBy: Array<IssueRelationNodeData>
}

export type IssueParentSetData = {
  issueId: string
  parentIssueId: string
}

export type IssueParentRemoveData = {
  issueId: string
  parentRemoved: boolean
}

export type IssueBlockedByData = {
  issueId: string
  blockedByIssueId: string
  removed?: boolean
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
  createIssue(input: IssueCreateInput): Promise<IssueMutationData>
  updateIssue(input: IssueUpdateInput): Promise<IssueMutationData>
  closeIssue(input: IssueMutationInput): Promise<IssueMutationData>
  reopenIssue(input: IssueMutationInput): Promise<IssueMutationData>
  deleteIssue(input: IssueMutationInput): Promise<IssueMutationData>
  updateIssueLabels(input: IssueLabelsUpdateInput): Promise<IssueLabelsUpdateData>
  updateIssueAssignees(input: IssueAssigneesUpdateInput): Promise<IssueAssigneesUpdateData>
  setIssueMilestone(input: IssueMilestoneSetInput): Promise<IssueMilestoneSetData>
  createIssueComment(input: IssueCommentCreateInput): Promise<IssueCommentCreateData>
  fetchIssueLinkedPrs(input: IssueLinkedPrsListInput): Promise<IssueLinkedPrsListData>
  fetchIssueRelations(input: IssueRelationsGetInput): Promise<IssueRelationsGetData>
  setIssueParent(input: IssueParentSetInput): Promise<IssueParentSetData>
  removeIssueParent(input: IssueParentRemoveInput): Promise<IssueParentRemoveData>
  addIssueBlockedBy(input: IssueBlockedByInput): Promise<IssueBlockedByData>
  removeIssueBlockedBy(input: IssueBlockedByInput): Promise<IssueBlockedByData>
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

function assertNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`)
  }

  return value
}

function assertOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`)
  }

  return value
}

function assertStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || entry.trim().length === 0)) {
    throw new Error(`${fieldName} must be an array of non-empty strings`)
  }

  return value
}

function assertIssueCreateInput(input: IssueCreateInput): void {
  assertRepoInput({ owner: input.owner, name: input.name })
  assertNonEmptyString(input.title, "Issue title")
  assertOptionalString(input.body, "Issue body")
}

function assertIssueUpdateInput(input: IssueUpdateInput): void {
  assertNonEmptyString(input.issueId, "Issue id")
  if (input.title === undefined && input.body === undefined) {
    throw new Error("Issue update requires at least one field")
  }
  if (input.title !== undefined) {
    assertOptionalString(input.title, "Issue title")
  }
  if (input.body !== undefined) {
    assertOptionalString(input.body, "Issue body")
  }
}

function assertIssueMutationInput(input: IssueMutationInput): void {
  assertNonEmptyString(input.issueId, "Issue id")
}

function assertIssueLabelsUpdateInput(input: IssueLabelsUpdateInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertStringArray(input.labels, "Labels")
}

function assertIssueAssigneesUpdateInput(input: IssueAssigneesUpdateInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertStringArray(input.assignees, "Assignees")
}

function assertIssueMilestoneSetInput(input: IssueMilestoneSetInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  if (input.milestoneNumber !== null && (!Number.isInteger(input.milestoneNumber) || input.milestoneNumber <= 0)) {
    throw new Error("Milestone number must be a positive integer or null")
  }
}

function assertIssueCommentCreateInput(input: IssueCommentCreateInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertNonEmptyString(input.body, "Issue comment body")
}

function assertIssueLinkedPrsListInput(input: IssueLinkedPrsListInput): void {
  assertIssueInput(input)
}

function assertIssueRelationsGetInput(input: IssueRelationsGetInput): void {
  assertIssueInput(input)
}

function assertIssueParentSetInput(input: IssueParentSetInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertNonEmptyString(input.parentIssueId, "Parent issue id")
}

function assertIssueParentRemoveInput(input: IssueParentRemoveInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
}

function assertIssueBlockedByInput(input: IssueBlockedByInput): void {
  assertIssueMutationInput({ issueId: input.issueId })
  assertNonEmptyString(input.blockedByIssueId, "Blocked-by issue id")
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
  if (
    typeof input.owner !== "string"
    || typeof input.name !== "string"
    || input.owner.trim().length === 0
    || input.name.trim().length === 0
  ) {
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
  if (
    typeof input.owner !== "string"
    || typeof input.name !== "string"
    || input.owner.trim().length === 0
    || input.name.trim().length === 0
  ) {
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
  if (
    typeof input.owner !== "string"
    || typeof input.name !== "string"
    || input.owner.trim().length === 0
    || input.name.trim().length === 0
  ) {
    throw new Error("Repository owner and name are required")
  }
  if (!Number.isInteger(input.prNumber) || input.prNumber <= 0) {
    throw new Error("PR number must be a positive integer")
  }
  if (!Number.isInteger(input.first) || input.first <= 0) {
    throw new Error("List page size must be a positive integer")
  }
  if (input.unresolvedOnly !== undefined && typeof input.unresolvedOnly !== "boolean") {
    throw new Error("unresolvedOnly must be a boolean")
  }
  if (input.includeOutdated !== undefined && typeof input.includeOutdated !== "boolean") {
    throw new Error("includeOutdated must be a boolean")
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

const ISSUE_CREATE_REPOSITORY_ID_QUERY = `
  query IssueCreateRepositoryId($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`

const ISSUE_CREATE_MUTATION = `
  mutation IssueCreate($repositoryId: ID!, $title: String!, $body: String) {
    createIssue(input: { repositoryId: $repositoryId, title: $title, body: $body }) {
      issue {
        id
        number
        title
        state
        url
      }
    }
  }
`

const ISSUE_UPDATE_MUTATION = `
  mutation IssueUpdate($issueId: ID!, $title: String, $body: String) {
    updateIssue(input: { id: $issueId, title: $title, body: $body }) {
      issue {
        id
        number
        title
        state
        url
      }
    }
  }
`

const ISSUE_CLOSE_MUTATION = `
  mutation IssueClose($issueId: ID!) {
    closeIssue(input: { issueId: $issueId }) {
      issue {
        id
        number
        state
      }
    }
  }
`

const ISSUE_REOPEN_MUTATION = `
  mutation IssueReopen($issueId: ID!) {
    reopenIssue(input: { issueId: $issueId }) {
      issue {
        id
        number
        state
      }
    }
  }
`

const ISSUE_DELETE_MUTATION = `
  mutation IssueDelete($issueId: ID!) {
    deleteIssue(input: { issueId: $issueId }) {
      clientMutationId
    }
  }
`

const ISSUE_LABELS_UPDATE_MUTATION = `
  mutation IssueLabelsUpdate($issueId: ID!, $labelIds: [ID!]!) {
    updateIssue(input: { id: $issueId, labelIds: $labelIds }) {
      issue {
        id
        labels(first: 50) {
          nodes {
            name
          }
        }
      }
    }
  }
`

const ISSUE_ASSIGNEES_UPDATE_MUTATION = `
  mutation IssueAssigneesUpdate($issueId: ID!, $assigneeIds: [ID!]!) {
    updateIssue(input: { id: $issueId, assigneeIds: $assigneeIds }) {
      issue {
        id
        assignees(first: 50) {
          nodes {
            login
          }
        }
      }
    }
  }
`

const ISSUE_MILESTONE_SET_MUTATION = `
  mutation IssueMilestoneSet($issueId: ID!, $milestoneId: ID) {
    updateIssue(input: { id: $issueId, milestoneId: $milestoneId }) {
      issue {
        id
        milestone {
          number
        }
      }
    }
  }
`

const ISSUE_LABELS_LOOKUP_QUERY = `
  query IssueLabelsLookup($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        repository {
          labels(first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    }
  }
`

const ISSUE_ASSIGNEES_LOOKUP_QUERY = `
  query IssueAssigneesLookup($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        repository {
          assignableUsers(first: 100) {
            nodes {
              id
              login
            }
          }
        }
      }
    }
  }
`

const ISSUE_MILESTONE_LOOKUP_QUERY = `
  query IssueMilestoneLookup($issueId: ID!, $milestoneNumber: Int!) {
    node(id: $issueId) {
      ... on Issue {
        repository {
          milestone(number: $milestoneNumber) {
            id
          }
        }
      }
    }
  }
`

const ISSUE_COMMENT_CREATE_MUTATION = `
  mutation IssueCommentCreate($issueId: ID!, $body: String!) {
    addComment(input: { subjectId: $issueId, body: $body }) {
      commentEdge {
        node {
          id
          body
          url
        }
      }
    }
  }
`

const ISSUE_LINKED_PRS_LIST_QUERY = `
  query IssueLinkedPrsList($owner: String!, $name: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $issueNumber) {
        timelineItems(first: 50, itemTypes: [CONNECTED_EVENT]) {
          nodes {
            __typename
            ... on ConnectedEvent {
              subject {
                __typename
                ... on PullRequest {
                  id
                  number
                  title
                  state
                  url
                }
              }
            }
          }
        }
      }
    }
  }
`

const ISSUE_RELATIONS_GET_QUERY = `
  query IssueRelationsGet($owner: String!, $name: String!, $issueNumber: Int!) {
    repository(owner: $owner, name: $name) {
      issue(number: $issueNumber) {
        id
        number
        parent {
          id
          number
        }
        subIssues(first: 50) {
          nodes {
            id
            number
          }
        }
        blockedBy(first: 50) {
          nodes {
            id
            number
          }
        }
      }
    }
  }
`

const ISSUE_PARENT_LOOKUP_QUERY = `
  query IssueParentLookup($issueId: ID!) {
    node(id: $issueId) {
      ... on Issue {
        id
        parent {
          id
        }
      }
    }
  }
`

const ISSUE_PARENT_SET_MUTATION = `
  mutation IssueParentSet($issueId: ID!, $parentIssueId: ID!) {
    addSubIssue(input: { issueId: $parentIssueId, subIssueId: $issueId }) {
      issue { id }
      subIssue { id }
    }
  }
`

const ISSUE_PARENT_REMOVE_MUTATION = `
  mutation IssueParentRemove($issueId: ID!, $parentIssueId: ID!) {
    removeSubIssue(input: { issueId: $parentIssueId, subIssueId: $issueId }) {
      issue { id }
      subIssue { id }
    }
  }
`

const ISSUE_BLOCKED_BY_ADD_MUTATION = `
  mutation IssueBlockedByAdd($issueId: ID!, $blockedByIssueId: ID!) {
    addBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockedByIssueId }) {
      issue { id }
      blockingIssue { id }
    }
  }
`

const ISSUE_BLOCKED_BY_REMOVE_MUTATION = `
  mutation IssueBlockedByRemove($issueId: ID!, $blockedByIssueId: ID!) {
    removeBlockedBy(input: { issueId: $issueId, blockingIssueId: $blockedByIssueId }) {
      issue { id }
      blockingIssue { id }
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

function parseIssueNode(issue: unknown): IssueMutationData {
  const issueRecord = asRecord(issue)
  if (!issueRecord || typeof issueRecord.id !== "string" || typeof issueRecord.number !== "number") {
    throw new Error("Issue mutation failed")
  }

  const result: IssueMutationData = {
    id: issueRecord.id,
    number: issueRecord.number,
  }

  if (typeof issueRecord.title === "string") {
    result.title = issueRecord.title
  }
  if (typeof issueRecord.state === "string") {
    result.state = issueRecord.state
  }
  if (typeof issueRecord.url === "string") {
    result.url = issueRecord.url
  }

  return result
}

async function runIssueCreate(graphqlClient: GraphqlClient, input: IssueCreateInput): Promise<IssueMutationData> {
  assertIssueCreateInput(input)

  const repositoryLookupResult = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_CREATE_REPOSITORY_ID_QUERY, {
    owner: input.owner,
    name: input.name
  })
  const repositoryId = asRecord(asRecord(repositoryLookupResult)?.repository)?.id
  if (typeof repositoryId !== "string" || repositoryId.length === 0) {
    throw new Error("Repository not found")
  }

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_CREATE_MUTATION, {
    repositoryId,
    title: input.title,
    body: input.body
  })
  const issue = asRecord(asRecord(result)?.createIssue)?.issue
  return parseIssueNode(issue)
}

async function runIssueUpdate(graphqlClient: GraphqlClient, input: IssueUpdateInput): Promise<IssueMutationData> {
  assertIssueUpdateInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_UPDATE_MUTATION, {
    issueId: input.issueId,
    title: input.title,
    body: input.body
  })
  const issue = asRecord(asRecord(result)?.updateIssue)?.issue
  return parseIssueNode(issue)
}

async function runIssueClose(graphqlClient: GraphqlClient, input: IssueMutationInput): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_CLOSE_MUTATION, {
    issueId: input.issueId
  })
  const issueData = parseIssueNode(asRecord(asRecord(result)?.closeIssue)?.issue)
  return {
    ...issueData,
    closed: issueData.state === "CLOSED"
  }
}

async function runIssueReopen(graphqlClient: GraphqlClient, input: IssueMutationInput): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_REOPEN_MUTATION, {
    issueId: input.issueId
  })
  const issueData = parseIssueNode(asRecord(asRecord(result)?.reopenIssue)?.issue)
  return {
    ...issueData,
    reopened: issueData.state === "OPEN"
  }
}

async function runIssueDelete(graphqlClient: GraphqlClient, input: IssueMutationInput): Promise<IssueMutationData> {
  assertIssueMutationInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_DELETE_MUTATION, {
    issueId: input.issueId
  })
  const mutation = asRecord(asRecord(result)?.deleteIssue)
  if (!mutation) {
    throw new Error("Issue deletion failed")
  }

  return {
    id: input.issueId,
    number: 0,
    deleted: true
  }
}

async function runIssueLabelsUpdate(
  graphqlClient: GraphqlClient,
  input: IssueLabelsUpdateInput
): Promise<IssueLabelsUpdateData> {
  assertIssueLabelsUpdateInput(input)

  const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_LABELS_LOOKUP_QUERY, {
    issueId: input.issueId
  })
  const availableLabels = Array.isArray(
    asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.labels)?.nodes
  )
    ? asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.labels)?.nodes as unknown[]
    : []
  const labelIdsByName = new Map<string, string>()
  for (const label of availableLabels) {
    const labelRecord = asRecord(label)
    if (typeof labelRecord?.name === "string" && typeof labelRecord?.id === "string") {
      labelIdsByName.set(labelRecord.name.toLowerCase(), labelRecord.id)
    }
  }
  const labelIds = input.labels.map((labelName) => {
    const id = labelIdsByName.get(labelName.toLowerCase())
    if (!id) {
      throw new Error(`Label not found: ${labelName}`)
    }
    return id
  })

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_LABELS_UPDATE_MUTATION, {
    issueId: input.issueId,
    labelIds
  })
  const mutation = asRecord(asRecord(result)?.["updateIssue"])
  const issue = asRecord(mutation?.["issue"])
  const labels = asRecord(issue?.["labels"])
  const labelNodes = Array.isArray(labels?.["nodes"]) ? labels["nodes"] : []

  return {
    id: assertNonEmptyString(issue?.["id"], "Issue id"),
    labels: labelNodes
      .map((label) => asRecord(label)?.["name"])
      .filter((name): name is string => typeof name === "string")
  }
}

async function runIssueAssigneesUpdate(
  graphqlClient: GraphqlClient,
  input: IssueAssigneesUpdateInput
): Promise<IssueAssigneesUpdateData> {
  assertIssueAssigneesUpdateInput(input)

  const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_ASSIGNEES_LOOKUP_QUERY, {
    issueId: input.issueId
  })
  const availableAssignees = Array.isArray(
    asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.assignableUsers)?.nodes
  )
    ? asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.assignableUsers)?.nodes as unknown[]
    : []
  const assigneeIdsByLogin = new Map<string, string>()
  for (const assignee of availableAssignees) {
    const assigneeRecord = asRecord(assignee)
    if (typeof assigneeRecord?.login === "string" && typeof assigneeRecord?.id === "string") {
      assigneeIdsByLogin.set(assigneeRecord.login.toLowerCase(), assigneeRecord.id)
    }
  }
  const assigneeIds = input.assignees.map((login) => {
    const id = assigneeIdsByLogin.get(login.toLowerCase())
    if (!id) {
      throw new Error(`Assignee not found: ${login}`)
    }
    return id
  })

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_ASSIGNEES_UPDATE_MUTATION, {
    issueId: input.issueId,
    assigneeIds
  })
  const mutation = asRecord(asRecord(result)?.["updateIssue"])
  const issue = asRecord(mutation?.["issue"])
  const assignees = asRecord(issue?.["assignees"])
  const assigneeNodes = Array.isArray(assignees?.["nodes"]) ? assignees["nodes"] : []

  return {
    id: assertNonEmptyString(issue?.["id"], "Issue id"),
    assignees: assigneeNodes
      .map((assignee) => asRecord(assignee)?.["login"])
      .filter((login): login is string => typeof login === "string")
  }
}

async function runIssueMilestoneSet(
  graphqlClient: GraphqlClient,
  input: IssueMilestoneSetInput
): Promise<IssueMilestoneSetData> {
  assertIssueMilestoneSetInput(input)

  let milestoneId: string | null = null
  if (input.milestoneNumber !== null) {
    const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_MILESTONE_LOOKUP_QUERY, {
      issueId: input.issueId,
      milestoneNumber: input.milestoneNumber
    })
    const resolvedId = asRecord(asRecord(asRecord(asRecord(lookupResult)?.node)?.repository)?.milestone)?.id
    if (typeof resolvedId !== "string" || resolvedId.length === 0) {
      throw new Error(`Milestone not found: ${input.milestoneNumber}`)
    }
    milestoneId = resolvedId
  }

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_MILESTONE_SET_MUTATION, {
    issueId: input.issueId,
    milestoneId
  })
  const mutation = asRecord(asRecord(result)?.["updateIssue"])
  const issue = asRecord(mutation?.["issue"])
  const milestone = asRecord(issue?.["milestone"])

  return {
    id: assertNonEmptyString(issue?.["id"], "Issue id"),
    milestoneNumber: typeof milestone?.["number"] === "number" ? milestone["number"] : null
  }
}

async function runIssueCommentCreate(
  graphqlClient: GraphqlClient,
  input: IssueCommentCreateInput
): Promise<IssueCommentCreateData> {
  assertIssueCommentCreateInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_COMMENT_CREATE_MUTATION, {
    issueId: input.issueId,
    body: input.body
  })
  const mutation = asRecord(asRecord(result)?.["addComment"])
  const commentEdge = asRecord(mutation?.["commentEdge"])
  const node = asRecord(commentEdge?.["node"])
  if (!node || typeof node["id"] !== "string" || typeof node["body"] !== "string") {
    throw new Error("Issue comment creation failed")
  }

  return {
    id: node["id"],
    body: node["body"],
    url: typeof node["url"] === "string" ? node["url"] : ""
  }
}

async function runIssueLinkedPrsList(
  graphqlClient: GraphqlClient,
  input: IssueLinkedPrsListInput
): Promise<IssueLinkedPrsListData> {
  assertIssueLinkedPrsListInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_LINKED_PRS_LIST_QUERY, {
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber
  })
  const issue = asRecord(asRecord(asRecord(result)?.repository)?.issue)
  const timelineItems = asRecord(issue?.timelineItems)
  const nodes = Array.isArray(timelineItems?.nodes) ? timelineItems.nodes : []

  return {
    items: nodes
      .map((node) => asRecord(asRecord(node)?.["subject"]))
      .filter((subject): subject is Record<string, unknown> => Boolean(subject) && subject?.["__typename"] === "PullRequest")
      .flatMap((subject) => {
        if (!subject) {
          return []
        }

        if (
          typeof subject["id"] !== "string"
          || typeof subject["number"] !== "number"
          || typeof subject["title"] !== "string"
          || typeof subject["state"] !== "string"
          || typeof subject["url"] !== "string"
        ) {
          return []
        }

        return [{
          id: subject["id"],
          number: subject["number"],
          title: subject["title"],
          state: subject["state"],
          url: subject["url"]
        }]
      })
  }
}

function parseIssueRelationNode(node: unknown): IssueRelationNodeData | null {
  const record = asRecord(node)
  if (!record || typeof record.id !== "string" || typeof record.number !== "number") {
    return null
  }

  return {
    id: record.id,
    number: record.number
  }
}

async function runIssueRelationsGet(
  graphqlClient: GraphqlClient,
  input: IssueRelationsGetInput
): Promise<IssueRelationsGetData> {
  assertIssueRelationsGetInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_RELATIONS_GET_QUERY, {
    owner: input.owner,
    name: input.name,
    issueNumber: input.issueNumber
  })
  const issue = asRecord(asRecord(asRecord(result)?.repository)?.issue)
  const currentIssue = parseIssueRelationNode(issue)
  if (!currentIssue) {
    throw new Error("Issue relations not found")
  }

  const parent = parseIssueRelationNode(issue?.parent)
  const subIssues = asRecord(issue?.["subIssues"])
  const blockedByConnection = asRecord(issue?.["blockedBy"])
  const childrenNodes = Array.isArray(subIssues?.["nodes"]) ? subIssues["nodes"] : []
  const blockedByNodes = Array.isArray(blockedByConnection?.["nodes"]) ? blockedByConnection["nodes"] : []

  return {
    issue: currentIssue,
    parent,
    children: childrenNodes
      .map((node) => parseIssueRelationNode(node))
      .flatMap((node) => (node ? [node] : [])),
    blockedBy: blockedByNodes
      .map((node) => parseIssueRelationNode(node))
      .flatMap((node) => (node ? [node] : []))
  }
}

async function runIssueParentSet(graphqlClient: GraphqlClient, input: IssueParentSetInput): Promise<IssueParentSetData> {
  assertIssueParentSetInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_PARENT_SET_MUTATION, {
    issueId: input.issueId,
    parentIssueId: input.parentIssueId
  })
  const mutation = asRecord(asRecord(result)?.addSubIssue)
  const parentIssue = asRecord(mutation?.issue)
  const subIssue = asRecord(mutation?.subIssue)
  if (typeof parentIssue?.id !== "string" || typeof subIssue?.id !== "string") {
    throw new Error("Issue parent update failed")
  }

  return {
    issueId: subIssue.id,
    parentIssueId: parentIssue.id
  }
}

async function runIssueParentRemove(
  graphqlClient: GraphqlClient,
  input: IssueParentRemoveInput
): Promise<IssueParentRemoveData> {
  assertIssueParentRemoveInput(input)

  const lookupResult = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_PARENT_LOOKUP_QUERY, {
    issueId: input.issueId
  })
  const parentIssueId = asRecord(asRecord(asRecord(lookupResult)?.node)?.parent)?.id
  if (typeof parentIssueId !== "string" || parentIssueId.length === 0) {
    throw new Error("Issue parent removal failed")
  }

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_PARENT_REMOVE_MUTATION, {
    issueId: input.issueId,
    parentIssueId
  })
  const mutation = asRecord(asRecord(result)?.removeSubIssue)
  const parentIssue = asRecord(mutation?.issue)
  const subIssue = asRecord(mutation?.subIssue)
  if (typeof parentIssue?.id !== "string" || typeof subIssue?.id !== "string") {
    throw new Error("Issue parent removal failed")
  }

  return {
    issueId: subIssue.id,
    parentRemoved: true
  }
}

async function runIssueBlockedByAdd(
  graphqlClient: GraphqlClient,
  input: IssueBlockedByInput
): Promise<IssueBlockedByData> {
  assertIssueBlockedByInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_BLOCKED_BY_ADD_MUTATION, {
    issueId: input.issueId,
    blockedByIssueId: input.blockedByIssueId
  })
  const mutation = asRecord(asRecord(result)?.addBlockedBy)
  const issue = asRecord(mutation?.issue)
  const blockingIssue = asRecord(mutation?.blockingIssue)
  if (typeof issue?.id !== "string" || typeof blockingIssue?.id !== "string") {
    throw new Error("Issue dependency mutation failed")
  }

  return {
    issueId: issue.id,
    blockedByIssueId: blockingIssue.id
  }
}

async function runIssueBlockedByRemove(
  graphqlClient: GraphqlClient,
  input: IssueBlockedByInput
): Promise<IssueBlockedByData> {
  assertIssueBlockedByInput(input)

  const result = await graphqlClient.query<unknown, GraphqlVariables>(ISSUE_BLOCKED_BY_REMOVE_MUTATION, {
    issueId: input.issueId,
    blockedByIssueId: input.blockedByIssueId
  })
  const mutation = asRecord(asRecord(result)?.removeBlockedBy)
  const issue = asRecord(mutation?.issue)
  const blockingIssue = asRecord(mutation?.blockingIssue)
  if (typeof issue?.id !== "string" || typeof blockingIssue?.id !== "string") {
    throw new Error("Issue dependency mutation failed")
  }

  return {
    issueId: issue.id,
    blockedByIssueId: blockingIssue.id,
    removed: true
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
      after: sourceEndCursor
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
              node: edgeRecord.node
            }
          })
          .flatMap((edge) => (edge ? [edge] : []))
      : []

    const threadNodes = threadEdges.length > 0
      ? threadEdges
      : (Array.isArray(reviewThreads.nodes) ? reviewThreads.nodes.map((node) => ({ cursor: null, node })) : [])

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
  const endCursor = returnedThreads.length > 0
    ? (returnedThreads[returnedThreads.length - 1]?.cursor ?? sourceEndCursor)
    : sourceEndCursor
  const scanTruncated = sourceHasNextPage && pagesScanned >= MAX_PR_REVIEW_THREAD_SCAN_PAGES

  return {
    items: returnedThreads.map((entry) => entry.thread),
    pageInfo: {
      hasNextPage: hasBufferedFilteredItems || sourceHasNextPage,
      endCursor: hasBufferedFilteredItems || sourceHasNextPage ? endCursor : null
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
  if (typeof input.threadId !== "string" || input.threadId.trim().length === 0) {
    throw new Error("Review thread id is required")
  }
}

function assertReplyToReviewThreadInput(input: ReplyToReviewThreadInput): void {
  assertReviewThreadInput(input)
  if (typeof input.body !== "string" || input.body.trim().length === 0) {
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
    createIssue: (input) => runIssueCreate(graphqlClient, input),
    updateIssue: (input) => runIssueUpdate(graphqlClient, input),
    closeIssue: (input) => runIssueClose(graphqlClient, input),
    reopenIssue: (input) => runIssueReopen(graphqlClient, input),
    deleteIssue: (input) => runIssueDelete(graphqlClient, input),
    updateIssueLabels: (input) => runIssueLabelsUpdate(graphqlClient, input),
    updateIssueAssignees: (input) => runIssueAssigneesUpdate(graphqlClient, input),
    setIssueMilestone: (input) => runIssueMilestoneSet(graphqlClient, input),
    createIssueComment: (input) => runIssueCommentCreate(graphqlClient, input),
    fetchIssueLinkedPrs: (input) => runIssueLinkedPrsList(graphqlClient, input),
    fetchIssueRelations: (input) => runIssueRelationsGet(graphqlClient, input),
    setIssueParent: (input) => runIssueParentSet(graphqlClient, input),
    removeIssueParent: (input) => runIssueParentRemove(graphqlClient, input),
    addIssueBlockedBy: (input) => runIssueBlockedByAdd(graphqlClient, input),
    removeIssueBlockedBy: (input) => runIssueBlockedByRemove(graphqlClient, input),
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
