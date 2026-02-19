import { IssueAssigneesUpdateDocument } from "./operations/issue-assignees-update.generated.js"
import { IssueCommentCreateDocument } from "./operations/issue-comment-create.generated.js"
import { IssueLabelsUpdateDocument } from "./operations/issue-labels-update.generated.js"
import { IssueMilestoneSetDocument } from "./operations/issue-milestone-set.generated.js"
import { IssueUpdateDocument } from "./operations/issue-update.generated.js"
import { PrCommentReplyDocument } from "./operations/pr-comment-reply.generated.js"
import { PrCommentResolveDocument } from "./operations/pr-comment-resolve.generated.js"
import { PrCommentUnresolveDocument } from "./operations/pr-comment-unresolve.generated.js"
import type { GraphqlVariables } from "./transport.js"

export const PR_COMMENT_REPLY_MUTATION = PrCommentReplyDocument

export const PR_COMMENT_RESOLVE_MUTATION = PrCommentResolveDocument

export const PR_COMMENT_UNRESOLVE_MUTATION = PrCommentUnresolveDocument

const ISSUE_UPDATE_MUTATION = IssueUpdateDocument

const ISSUE_LABELS_UPDATE_BY_ID_MUTATION = IssueLabelsUpdateDocument

const ISSUE_ASSIGNEES_UPDATE_BY_ID_MUTATION = IssueAssigneesUpdateDocument

const ISSUE_MILESTONE_SET_BY_ID_MUTATION = IssueMilestoneSetDocument

const ISSUE_COMMENT_CREATE_MUTATION = IssueCommentCreateDocument

export type BuiltOperation = {
  mutation: string
  variables: GraphqlVariables
}

export type OperationBuilder = {
  build: (input: Record<string, unknown>) => BuiltOperation
  mapResponse: (raw: unknown) => unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

function assertNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`)
  }

  return value
}

export const replyBuilder: OperationBuilder = {
  build(input) {
    const threadId = assertNonEmptyString(input.threadId, "threadId")
    const body = assertNonEmptyString(input.body, "body")

    return {
      mutation: PR_COMMENT_REPLY_MUTATION,
      variables: { threadId, body },
    }
  },
  mapResponse(raw) {
    const mutation = asRecord(raw)
    const comment = asRecord(mutation.comment)
    if (typeof comment.id !== "string") {
      throw new Error("Review thread mutation failed")
    }

    return { id: comment.id }
  },
}

export const resolveBuilder: OperationBuilder = {
  build(input) {
    const threadId = assertNonEmptyString(input.threadId, "threadId")

    return {
      mutation: PR_COMMENT_RESOLVE_MUTATION,
      variables: { threadId },
    }
  },
  mapResponse(raw) {
    const mutation = asRecord(raw)
    const thread = asRecord(mutation.thread)
    if (typeof thread.id !== "string") {
      throw new Error("Review thread mutation failed")
    }

    return { id: thread.id, isResolved: Boolean(thread.isResolved) }
  },
}

export const unresolveBuilder: OperationBuilder = {
  build(input) {
    const threadId = assertNonEmptyString(input.threadId, "threadId")

    return {
      mutation: PR_COMMENT_UNRESOLVE_MUTATION,
      variables: { threadId },
    }
  },
  mapResponse(raw) {
    const mutation = asRecord(raw)
    const thread = asRecord(mutation.thread)
    if (typeof thread.id !== "string") {
      throw new Error("Review thread mutation failed")
    }

    return { id: thread.id, isResolved: Boolean(thread.isResolved) }
  },
}

const issueUpdateBuilder: OperationBuilder = {
  build(input) {
    const issueId = assertNonEmptyString(input.issueId, "issueId")
    const title = typeof input.title === "string" ? input.title : undefined
    const body = typeof input.body === "string" ? input.body : undefined

    if (title === undefined && body === undefined) {
      throw new Error("issue.update requires at least one field")
    }

    const variables: GraphqlVariables = { issueId }
    if (title !== undefined) {
      variables.title = title
    }
    if (body !== undefined) {
      variables.body = body
    }

    return {
      mutation: ISSUE_UPDATE_MUTATION,
      variables,
    }
  },
  mapResponse(raw) {
    const issue = asRecord(asRecord(raw).issue)
    if (typeof issue.id !== "string" || typeof issue.number !== "number") {
      throw new Error("Issue update failed")
    }

    return {
      id: issue.id,
      number: issue.number,
      ...(typeof issue.title === "string" ? { title: issue.title } : {}),
      ...(typeof issue.state === "string" ? { state: issue.state } : {}),
      ...(typeof issue.url === "string" ? { url: issue.url } : {}),
    }
  },
}

const issueLabelsUpdateBuilder: OperationBuilder = {
  build(input) {
    const issueId = assertNonEmptyString(input.issueId, "issueId")
    const labels = input.labelIds ?? input.labels
    if (!Array.isArray(labels) || labels.some((id) => typeof id !== "string")) {
      throw new Error("labelIds (or labels) must be an array of strings")
    }

    return {
      mutation: ISSUE_LABELS_UPDATE_BY_ID_MUTATION,
      variables: { issueId, labelIds: labels },
    }
  },
  mapResponse(raw) {
    const issue = asRecord(asRecord(raw).issue)
    const labelNodes = asRecord(issue.labels).nodes
    const labels = Array.isArray(labelNodes)
      ? labelNodes
          .map((label) => asRecord(label).name)
          .filter((name): name is string => typeof name === "string")
      : []

    if (typeof issue.id !== "string") {
      throw new Error("Issue labels update failed")
    }

    return { issueId: issue.id, labels }
  },
}

const issueAssigneesUpdateBuilder: OperationBuilder = {
  build(input) {
    const issueId = assertNonEmptyString(input.issueId, "issueId")
    const assignees = input.assigneeIds ?? input.assignees
    if (!Array.isArray(assignees) || assignees.some((id) => typeof id !== "string")) {
      throw new Error("assigneeIds (or assignees) must be an array of strings")
    }

    return {
      mutation: ISSUE_ASSIGNEES_UPDATE_BY_ID_MUTATION,
      variables: { issueId, assigneeIds: assignees },
    }
  },
  mapResponse(raw) {
    const issue = asRecord(asRecord(raw).issue)
    const assigneeNodes = asRecord(issue.assignees).nodes
    const assignees = Array.isArray(assigneeNodes)
      ? assigneeNodes
          .map((assignee) => asRecord(assignee).login)
          .filter((login): login is string => typeof login === "string")
      : []

    if (typeof issue.id !== "string") {
      throw new Error("Issue assignees update failed")
    }

    return { issueId: issue.id, assignees }
  },
}

const issueMilestoneSetBuilder: OperationBuilder = {
  build(input) {
    const issueId = assertNonEmptyString(input.issueId, "issueId")
    const milestoneInput =
      input.milestoneId !== undefined ? input.milestoneId : input.milestoneNumber
    const milestoneId =
      milestoneInput === null || typeof milestoneInput === "string" ? milestoneInput : undefined

    if (milestoneId === undefined) {
      throw new Error("milestoneId (or milestoneNumber) must be a string or null")
    }

    return {
      mutation: ISSUE_MILESTONE_SET_BY_ID_MUTATION,
      variables: { issueId, milestoneId },
    }
  },
  mapResponse(raw) {
    const issue = asRecord(asRecord(raw).issue)
    const milestone = asRecord(issue.milestone)

    if (typeof issue.id !== "string") {
      throw new Error("Issue milestone update failed")
    }

    return {
      issueId: issue.id,
      milestoneNumber: typeof milestone.number === "number" ? milestone.number : null,
    }
  },
}

const issueCommentCreateBuilder: OperationBuilder = {
  build(input) {
    const issueId = assertNonEmptyString(input.issueId, "issueId")
    const body = assertNonEmptyString(input.body, "body")

    return {
      mutation: ISSUE_COMMENT_CREATE_MUTATION,
      variables: { issueId, body },
    }
  },
  mapResponse(raw) {
    const node = asRecord(asRecord(raw).commentEdge).node
    const comment = asRecord(node)

    if (typeof comment.id !== "string" || typeof comment.body !== "string") {
      throw new Error("Issue comment creation failed")
    }

    return {
      commentId: comment.id,
      body: comment.body,
      url: typeof comment.url === "string" ? comment.url : "",
    }
  },
}

export const OPERATION_BUILDERS: Record<string, OperationBuilder> = {
  "pr.thread.reply": replyBuilder,
  "pr.thread.resolve": resolveBuilder,
  "pr.thread.unresolve": unresolveBuilder,
  "issue.update": issueUpdateBuilder,
  "issue.labels.update": issueLabelsUpdateBuilder,
  "issue.assignees.update": issueAssigneesUpdateBuilder,
  "issue.milestone.set": issueMilestoneSetBuilder,
  "issue.comments.create": issueCommentCreateBuilder,
}
