import type { GraphqlVariables } from "./client.js"
import {
  PR_COMMENT_REPLY_MUTATION,
  PR_COMMENT_RESOLVE_MUTATION,
  PR_COMMENT_UNRESOLVE_MUTATION,
} from "./client.js"

export type BuiltOperation = {
  mutation: string
  variables: GraphqlVariables
}

export type OperationBuilder = {
  build: (input: Record<string, unknown>) => BuiltOperation
  mapResponse: (raw: unknown) => unknown
}

export const replyBuilder: OperationBuilder = {
  build(input) {
    if (!input.threadId || typeof input.threadId !== "string") {
      throw new Error("threadId is required")
    }
    if (!input.body || typeof input.body !== "string") {
      throw new Error("body is required for reply")
    }
    return {
      mutation: PR_COMMENT_REPLY_MUTATION,
      variables: { threadId: input.threadId, body: input.body },
    }
  },
  mapResponse(raw) {
    // Reuses same parsing logic as runReplyToReviewThread
    const root = raw as Record<string, unknown>
    const mutation = root?.addPullRequestReviewThreadReply as Record<string, unknown>
    const comment = mutation?.comment as Record<string, unknown>
    if (!comment || typeof comment.id !== "string") {
      throw new Error("Review thread mutation failed")
    }
    return { id: comment.id }
  },
}

export const resolveBuilder: OperationBuilder = {
  build(input) {
    if (!input.threadId || typeof input.threadId !== "string") {
      throw new Error("threadId is required")
    }
    return {
      mutation: PR_COMMENT_RESOLVE_MUTATION,
      variables: { threadId: input.threadId },
    }
  },
  mapResponse(raw) {
    const root = raw as Record<string, unknown>
    const mutation = root?.resolveReviewThread as Record<string, unknown>
    const thread = mutation?.thread as Record<string, unknown>
    if (!thread || typeof thread.id !== "string") {
      throw new Error("Review thread mutation failed")
    }
    return { id: thread.id, isResolved: Boolean(thread.isResolved) }
  },
}

export const unresolveBuilder: OperationBuilder = {
  build(input) {
    if (!input.threadId || typeof input.threadId !== "string") {
      throw new Error("threadId is required")
    }
    return {
      mutation: PR_COMMENT_UNRESOLVE_MUTATION,
      variables: { threadId: input.threadId },
    }
  },
  mapResponse(raw) {
    const root = raw as Record<string, unknown>
    const mutation = root?.unresolveReviewThread as Record<string, unknown>
    const thread = mutation?.thread as Record<string, unknown>
    if (!thread || typeof thread.id !== "string") {
      throw new Error("Review thread mutation failed")
    }
    return { id: thread.id, isResolved: Boolean(thread.isResolved) }
  },
}

export const OPERATION_BUILDERS: Record<string, OperationBuilder> = {
  "pr.thread.reply": replyBuilder,
  "pr.thread.resolve": resolveBuilder,
  "pr.thread.unresolve": unresolveBuilder,
}
