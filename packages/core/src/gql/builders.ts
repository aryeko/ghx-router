import type { GraphqlVariables } from "./transport.js"

export const PR_COMMENT_REPLY_MUTATION = `
  mutation PrCommentReply($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
      comment {
        id
      }
    }
  }
`

export const PR_COMMENT_RESOLVE_MUTATION = `
  mutation PrCommentResolve($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
      }
    }
  }
`

export const PR_COMMENT_UNRESOLVE_MUTATION = `
  mutation PrCommentUnresolve($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
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

const ISSUE_LABELS_UPDATE_BY_ID_MUTATION = `
  mutation IssueLabelsUpdateById($issueId: ID!, $labelIds: [ID!]!) {
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

const ISSUE_ASSIGNEES_UPDATE_BY_ID_MUTATION = `
  mutation IssueAssigneesUpdateById($issueId: ID!, $assigneeIds: [ID!]!) {
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

const ISSUE_MILESTONE_SET_BY_ID_MUTATION = `
  mutation IssueMilestoneSetById($issueId: ID!, $milestoneId: ID) {
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

    return {
      mutation: ISSUE_UPDATE_MUTATION,
      variables: { issueId, title, body },
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
    if (!Array.isArray(input.labelIds) || input.labelIds.some((id) => typeof id !== "string")) {
      throw new Error("labelIds must be an array of strings")
    }

    return {
      mutation: ISSUE_LABELS_UPDATE_BY_ID_MUTATION,
      variables: { issueId, labelIds: input.labelIds },
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

    return {
      id: issue.id,
      labels,
    }
  },
}

const issueAssigneesUpdateBuilder: OperationBuilder = {
  build(input) {
    const issueId = assertNonEmptyString(input.issueId, "issueId")
    if (
      !Array.isArray(input.assigneeIds) ||
      input.assigneeIds.some((id) => typeof id !== "string")
    ) {
      throw new Error("assigneeIds must be an array of strings")
    }

    return {
      mutation: ISSUE_ASSIGNEES_UPDATE_BY_ID_MUTATION,
      variables: { issueId, assigneeIds: input.assigneeIds },
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

    return {
      id: issue.id,
      assignees,
    }
  },
}

const issueMilestoneSetBuilder: OperationBuilder = {
  build(input) {
    const issueId = assertNonEmptyString(input.issueId, "issueId")
    const milestoneId =
      input.milestoneId === null || typeof input.milestoneId === "string"
        ? input.milestoneId
        : undefined

    if (milestoneId === undefined) {
      throw new Error("milestoneId must be a string or null")
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
      id: issue.id,
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
      id: comment.id,
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
