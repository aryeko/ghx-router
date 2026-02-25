import type { GraphqlHandler } from "@core/gql/capability-registry.js"
import { getGraphqlHandler, listGraphqlCapabilities } from "@core/gql/capability-registry.js"
import type { GithubClient } from "@core/gql/github-client.js"
import { describe, expect, it, vi } from "vitest"

function requireHandler(capabilityId: string): GraphqlHandler {
  const handler = getGraphqlHandler(capabilityId)
  if (!handler) throw new Error(`Expected handler for ${capabilityId}`)
  return handler
}

function mockClient(overrides: Partial<GithubClient> = {}): GithubClient {
  return {
    query: vi.fn(),
    queryRaw: vi.fn(),
    fetchRepoView: vi.fn(),
    fetchIssueView: vi.fn(),
    fetchIssueList: vi.fn(),
    fetchIssueCommentsList: vi.fn(),
    fetchPrView: vi.fn(),
    fetchPrList: vi.fn(),
    fetchPrReviewsList: vi.fn(),
    fetchPrDiffListFiles: vi.fn(),
    fetchPrMergeStatus: vi.fn(),
    fetchPrCommentsList: vi.fn(),
    replyToReviewThread: vi.fn(),
    resolveReviewThread: vi.fn(),
    unresolveReviewThread: vi.fn(),
    fetchRepoLabelsList: vi.fn(),
    fetchRepoIssueTypesList: vi.fn(),
    fetchReleaseView: vi.fn(),
    fetchReleaseList: vi.fn(),
    fetchProjectV2OrgView: vi.fn(),
    fetchProjectV2UserView: vi.fn(),
    fetchProjectV2FieldsList: vi.fn(),
    fetchProjectV2ItemsList: vi.fn(),
    ...overrides,
  } as GithubClient
}

// --- getGraphqlHandler ---

describe("getGraphqlHandler", () => {
  it("returns a function for a known capability", () => {
    const handler = getGraphqlHandler("repo.view")
    expect(typeof handler).toBe("function")
  })

  it("returns undefined for an unknown capability", () => {
    const handler = getGraphqlHandler("does.not.exist")
    expect(handler).toBeUndefined()
  })

  it("returns distinct handlers for different capabilities", () => {
    const repoHandler = getGraphqlHandler("repo.view")
    const issueHandler = getGraphqlHandler("issue.view")
    expect(repoHandler).not.toBe(issueHandler)
  })
})

// --- listGraphqlCapabilities ---

describe("listGraphqlCapabilities", () => {
  it("returns an array of strings", () => {
    const caps = listGraphqlCapabilities()
    expect(Array.isArray(caps)).toBe(true)
    expect(caps.length).toBeGreaterThan(0)
    for (const c of caps) {
      expect(typeof c).toBe("string")
    }
  })

  it("includes known capability IDs", () => {
    const caps = listGraphqlCapabilities()
    expect(caps).toContain("repo.view")
    expect(caps).toContain("issue.view")
    expect(caps).toContain("issue.list")
    expect(caps).toContain("pr.view")
    expect(caps).toContain("pr.list")
    expect(caps).toContain("pr.create")
    expect(caps).toContain("pr.merge")
    expect(caps).toContain("release.view")
    expect(caps).toContain("project_v2.org.view")
    expect(caps).toContain("project_v2.items.field.update")
  })
})

// --- Query handler delegation ---

describe("query handlers", () => {
  it("repo.view delegates to fetchRepoView", async () => {
    const client = mockClient({ fetchRepoView: vi.fn().mockResolvedValue({ id: "R_1" }) })
    const handler = requireHandler("repo.view")
    const result = await handler(client, { owner: "acme", name: "repo" })
    expect(client.fetchRepoView).toHaveBeenCalledWith({ owner: "acme", name: "repo" })
    expect(result).toEqual({ id: "R_1" })
  })

  it("issue.view delegates to fetchIssueView", async () => {
    const client = mockClient({ fetchIssueView: vi.fn().mockResolvedValue({ number: 1 }) })
    const handler = requireHandler("issue.view")
    await handler(client, { owner: "acme", name: "repo", issueNumber: 1 })
    expect(client.fetchIssueView).toHaveBeenCalled()
  })

  it("pr.view delegates to fetchPrView", async () => {
    const client = mockClient({ fetchPrView: vi.fn().mockResolvedValue({ number: 42 }) })
    const handler = requireHandler("pr.view")
    await handler(client, { owner: "acme", name: "repo", prNumber: 42 })
    expect(client.fetchPrView).toHaveBeenCalled()
  })

  it("release.view delegates to fetchReleaseView", async () => {
    const client = mockClient({ fetchReleaseView: vi.fn().mockResolvedValue({ tagName: "v1" }) })
    const handler = requireHandler("release.view")
    await handler(client, { owner: "acme", name: "repo", tagName: "v1" })
    expect(client.fetchReleaseView).toHaveBeenCalled()
  })

  it("pr.reviews.list delegates to fetchPrReviewsList", async () => {
    const client = mockClient({ fetchPrReviewsList: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("pr.reviews.list")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, first: 10 })
    expect(client.fetchPrReviewsList).toHaveBeenCalled()
  })

  it("pr.diff.files delegates to fetchPrDiffListFiles", async () => {
    const client = mockClient({ fetchPrDiffListFiles: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("pr.diff.files")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, first: 10 })
    expect(client.fetchPrDiffListFiles).toHaveBeenCalled()
  })

  it("pr.merge.status delegates to fetchPrMergeStatus", async () => {
    const client = mockClient({ fetchPrMergeStatus: vi.fn().mockResolvedValue({}) })
    const handler = requireHandler("pr.merge.status")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1 })
    expect(client.fetchPrMergeStatus).toHaveBeenCalled()
  })

  it("repo.labels.list delegates to fetchRepoLabelsList", async () => {
    const client = mockClient({ fetchRepoLabelsList: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("repo.labels.list")
    await handler(client, { owner: "acme", name: "repo", first: 10 })
    expect(client.fetchRepoLabelsList).toHaveBeenCalled()
  })

  it("repo.issue_types.list delegates to fetchRepoIssueTypesList", async () => {
    const client = mockClient({ fetchRepoIssueTypesList: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("repo.issue_types.list")
    await handler(client, { owner: "acme", name: "repo", first: 10 })
    expect(client.fetchRepoIssueTypesList).toHaveBeenCalled()
  })

  it("issue.comments.list delegates to fetchIssueCommentsList", async () => {
    const client = mockClient({ fetchIssueCommentsList: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("issue.comments.list")
    await handler(client, { owner: "acme", name: "repo", issueNumber: 1, first: 10 })
    expect(client.fetchIssueCommentsList).toHaveBeenCalled()
  })

  it("pr.threads.reply delegates to replyToReviewThread", async () => {
    const client = mockClient({ replyToReviewThread: vi.fn().mockResolvedValue({}) })
    const handler = requireHandler("pr.threads.reply")
    await handler(client, { threadId: "T_1", body: "Thanks" })
    expect(client.replyToReviewThread).toHaveBeenCalledWith({ threadId: "T_1", body: "Thanks" })
  })

  it("pr.threads.resolve delegates to resolveReviewThread", async () => {
    const client = mockClient({ resolveReviewThread: vi.fn().mockResolvedValue({}) })
    const handler = requireHandler("pr.threads.resolve")
    await handler(client, { threadId: "T_1" })
    expect(client.resolveReviewThread).toHaveBeenCalledWith({ threadId: "T_1" })
  })

  it("pr.threads.unresolve delegates to unresolveReviewThread", async () => {
    const client = mockClient({ unresolveReviewThread: vi.fn().mockResolvedValue({}) })
    const handler = requireHandler("pr.threads.unresolve")
    await handler(client, { threadId: "T_1" })
    expect(client.unresolveReviewThread).toHaveBeenCalledWith({ threadId: "T_1" })
  })

  it("project_v2.org.view delegates to fetchProjectV2OrgView", async () => {
    const client = mockClient({ fetchProjectV2OrgView: vi.fn().mockResolvedValue({}) })
    const handler = requireHandler("project_v2.org.view")
    await handler(client, { org: "acme", projectNumber: 1 })
    expect(client.fetchProjectV2OrgView).toHaveBeenCalled()
  })

  it("project_v2.user.view delegates to fetchProjectV2UserView", async () => {
    const client = mockClient({ fetchProjectV2UserView: vi.fn().mockResolvedValue({}) })
    const handler = requireHandler("project_v2.user.view")
    await handler(client, { user: "octocat", projectNumber: 1 })
    expect(client.fetchProjectV2UserView).toHaveBeenCalled()
  })

  it("project_v2.fields.list delegates to fetchProjectV2FieldsList", async () => {
    const client = mockClient({ fetchProjectV2FieldsList: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("project_v2.fields.list")
    await handler(client, { owner: "acme", projectNumber: 1, first: 10 })
    expect(client.fetchProjectV2FieldsList).toHaveBeenCalled()
  })

  it("project_v2.items.list delegates to fetchProjectV2ItemsList", async () => {
    const client = mockClient({ fetchProjectV2ItemsList: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("project_v2.items.list")
    await handler(client, { owner: "acme", projectNumber: 1, first: 50 })
    expect(client.fetchProjectV2ItemsList).toHaveBeenCalled()
  })

  it("release.list delegates to fetchReleaseList", async () => {
    const client = mockClient({ fetchReleaseList: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("release.list")
    await handler(client, { owner: "acme", name: "repo", first: 10 })
    expect(client.fetchReleaseList).toHaveBeenCalled()
  })

  it("pr.threads.list delegates to fetchPrCommentsList", async () => {
    const client = mockClient({ fetchPrCommentsList: vi.fn().mockResolvedValue([]) })
    const handler = requireHandler("pr.threads.list")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, first: 10 })
    expect(client.fetchPrCommentsList).toHaveBeenCalled()
  })
})

// --- Mutation handlers: missing method throws ---

describe("mutation handlers throw when client method is missing", () => {
  it("issue.create throws when createIssue is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.create")
    expect(() => handler(client, { owner: "acme", name: "repo", title: "Bug" })).toThrow(
      "createIssue operation not available",
    )
  })

  it("pr.create delegates to createPr when present", async () => {
    const createPr = vi.fn().mockResolvedValue({ number: 10 })
    const client = mockClient({ createPr } as Partial<GithubClient>)
    const handler = requireHandler("pr.create")
    await handler(client, {
      owner: "acme",
      name: "repo",
      title: "Fix",
      head: "feature",
      base: "main",
    })
    expect(createPr).toHaveBeenCalled()
  })

  it("pr.merge delegates to mergePr when present", async () => {
    const mergePr = vi.fn().mockResolvedValue({ merged: true })
    const client = mockClient({ mergePr } as Partial<GithubClient>)
    const handler = requireHandler("pr.merge")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1 })
    expect(mergePr).toHaveBeenCalled()
  })

  it("pr.update delegates to updatePr when present", async () => {
    const updatePr = vi.fn().mockResolvedValue({ number: 1 })
    const client = mockClient({ updatePr } as Partial<GithubClient>)
    const handler = requireHandler("pr.update")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, title: "New" })
    expect(updatePr).toHaveBeenCalled()
  })

  it("issue.close throws when closeIssue is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.close")
    expect(() => handler(client, { owner: "acme", name: "repo", issueNumber: 1 })).toThrow(
      "closeIssue operation not available",
    )
  })

  it("issue.reopen throws when reopenIssue is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.reopen")
    expect(() => handler(client, { owner: "acme", name: "repo", issueNumber: 1 })).toThrow(
      "reopenIssue operation not available",
    )
  })

  it("issue.delete throws when deleteIssue is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.delete")
    expect(() => handler(client, { owner: "acme", name: "repo", issueNumber: 1 })).toThrow(
      "deleteIssue operation not available",
    )
  })

  it("issue.update throws when updateIssue is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.update")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", issueNumber: 1, title: "New" }),
    ).toThrow("updateIssue operation not available")
  })

  it("pr.branch.update delegates to updatePrBranch when present", async () => {
    const updatePrBranch = vi.fn().mockResolvedValue({})
    const client = mockClient({ updatePrBranch } as Partial<GithubClient>)
    const handler = requireHandler("pr.branch.update")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1 })
    expect(updatePrBranch).toHaveBeenCalled()
  })

  it("pr.assignees.add delegates to addPrAssignees when present", async () => {
    const addPrAssignees = vi.fn().mockResolvedValue({})
    const client = mockClient({ addPrAssignees } as Partial<GithubClient>)
    const handler = requireHandler("pr.assignees.add")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, assignees: ["user1"] })
    expect(addPrAssignees).toHaveBeenCalled()
  })

  it("pr.assignees.remove delegates to removePrAssignees when present", async () => {
    const removePrAssignees = vi.fn().mockResolvedValue({})
    const client = mockClient({ removePrAssignees } as Partial<GithubClient>)
    const handler = requireHandler("pr.assignees.remove")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, assignees: ["user1"] })
    expect(removePrAssignees).toHaveBeenCalled()
  })

  it("pr.reviews.request delegates to requestPrReviews when present", async () => {
    const requestPrReviews = vi.fn().mockResolvedValue({})
    const client = mockClient({ requestPrReviews } as Partial<GithubClient>)
    const handler = requireHandler("pr.reviews.request")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, reviewers: ["user1"] })
    expect(requestPrReviews).toHaveBeenCalled()
  })

  it("pr.reviews.submit throws when submitPrReview is not available", () => {
    const client = mockClient()
    const handler = requireHandler("pr.reviews.submit")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", prNumber: 1, event: "APPROVE" }),
    ).toThrow("submitPrReview operation not available")
  })

  it("issue.labels.add throws when addIssueLabels is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.labels.add")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", issueNumber: 1, labels: ["bug"] }),
    ).toThrow("addIssueLabels operation not available")
  })

  it("issue.labels.set throws when updateIssueLabels is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.labels.set")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", issueNumber: 1, labels: ["bug"] }),
    ).toThrow("updateIssueLabels operation not available")
  })

  it("issue.assignees.set throws when updateIssueAssignees is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.assignees.set")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", issueNumber: 1, assignees: ["user1"] }),
    ).toThrow("updateIssueAssignees operation not available")
  })

  it("issue.assignees.add throws when addIssueAssignees is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.assignees.add")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", issueNumber: 1, assignees: ["user1"] }),
    ).toThrow("addIssueAssignees operation not available")
  })

  it("issue.assignees.remove throws when removeIssueAssignees is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.assignees.remove")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", issueNumber: 1, assignees: ["user1"] }),
    ).toThrow("removeIssueAssignees operation not available")
  })

  it("issue.milestone.set throws when setIssueMilestone is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.milestone.set")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", issueNumber: 1, milestoneNumber: 1 }),
    ).toThrow("setIssueMilestone operation not available")
  })

  it("issue.comments.create throws when createIssueComment is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.comments.create")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", issueNumber: 1, body: "Hello" }),
    ).toThrow("createIssueComment operation not available")
  })

  it("issue.relations.prs.list throws when fetchIssueLinkedPrs is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.relations.prs.list")
    expect(() => handler(client, { owner: "acme", name: "repo", issueNumber: 1 })).toThrow(
      "fetchIssueLinkedPrs operation not available",
    )
  })

  it("issue.relations.view throws when fetchIssueRelations is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.relations.view")
    expect(() => handler(client, { owner: "acme", name: "repo", issueNumber: 1 })).toThrow(
      "fetchIssueRelations operation not available",
    )
  })

  it("issue.relations.parent.set throws when setIssueParent is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.relations.parent.set")
    expect(() => handler(client, { issueId: "I_1", parentIssueId: "I_2" })).toThrow(
      "setIssueParent operation not available",
    )
  })

  it("issue.relations.parent.remove throws when removeIssueParent is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.relations.parent.remove")
    expect(() => handler(client, { issueId: "I_1" })).toThrow(
      "removeIssueParent operation not available",
    )
  })

  it("issue.relations.blocked_by.add throws when addIssueBlockedBy is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.relations.blocked_by.add")
    expect(() => handler(client, { issueId: "I_1", blockedByIssueId: "I_2" })).toThrow(
      "addIssueBlockedBy operation not available",
    )
  })

  it("issue.relations.blocked_by.remove throws when removeIssueBlockedBy is not available", () => {
    const client = mockClient()
    const handler = requireHandler("issue.relations.blocked_by.remove")
    expect(() => handler(client, { issueId: "I_1", blockedByIssueId: "I_2" })).toThrow(
      "removeIssueBlockedBy operation not available",
    )
  })

  it("project_v2.items.issue.add delegates to addProjectV2Item when present", async () => {
    const addProjectV2Item = vi.fn().mockResolvedValue({ itemId: "PVI_1", itemType: "ISSUE" })
    const client = mockClient({ addProjectV2Item } as Partial<GithubClient>)
    const handler = requireHandler("project_v2.items.issue.add")
    await handler(client, { owner: "acme", projectNumber: 1, issueId: "I_1" })
    expect(addProjectV2Item).toHaveBeenCalled()
  })

  it("project_v2.items.issue.remove delegates to removeProjectV2Item when present", async () => {
    const removeProjectV2Item = vi.fn().mockResolvedValue({ deletedItemId: "PVI_1" })
    const client = mockClient({ removeProjectV2Item } as Partial<GithubClient>)
    const handler = requireHandler("project_v2.items.issue.remove")
    await handler(client, { owner: "acme", projectNumber: 1, itemId: "PVI_1" })
    expect(removeProjectV2Item).toHaveBeenCalled()
  })

  it("project_v2.items.field.update delegates to updateProjectV2ItemField when present", async () => {
    const updateProjectV2ItemField = vi.fn().mockResolvedValue({ itemId: "PVI_1" })
    const client = mockClient({ updateProjectV2ItemField } as Partial<GithubClient>)
    const handler = requireHandler("project_v2.items.field.update")
    await handler(client, {
      owner: "acme",
      projectNumber: 1,
      itemId: "PVI_1",
      fieldId: "F_1",
      value: "Done",
    })
    expect(updateProjectV2ItemField).toHaveBeenCalled()
  })
})

// --- Mutation handlers: call client when method is present ---

describe("mutation handlers call client when method is present", () => {
  it("issue.create calls createIssue", async () => {
    const createIssue = vi.fn().mockResolvedValue({ number: 99 })
    const client = mockClient({ createIssue } as Partial<GithubClient>)
    const handler = requireHandler("issue.create")
    const result = await handler(client, { owner: "acme", name: "repo", title: "Bug" })
    expect(createIssue).toHaveBeenCalled()
    expect(result).toEqual({ number: 99 })
  })

  it("pr.create calls createPr", async () => {
    const createPr = vi.fn().mockResolvedValue({ number: 10 })
    const client = mockClient({ createPr } as Partial<GithubClient>)
    const handler = requireHandler("pr.create")
    const result = await handler(client, {
      owner: "acme",
      name: "repo",
      title: "Fix",
      head: "feature",
      base: "main",
    })
    expect(createPr).toHaveBeenCalled()
    expect(result).toEqual({ number: 10 })
  })

  it("pr.merge calls mergePr", async () => {
    const mergePr = vi.fn().mockResolvedValue({ merged: true })
    const client = mockClient({ mergePr } as Partial<GithubClient>)
    const handler = requireHandler("pr.merge")
    const result = await handler(client, { owner: "acme", name: "repo", prNumber: 1 })
    expect(mergePr).toHaveBeenCalled()
    expect(result).toEqual({ merged: true })
  })

  it("issue.close calls closeIssue", async () => {
    const closeIssue = vi.fn().mockResolvedValue({ closed: true })
    const client = mockClient({ closeIssue } as Partial<GithubClient>)
    const handler = requireHandler("issue.close")
    await handler(client, { owner: "acme", name: "repo", issueNumber: 1 })
    expect(closeIssue).toHaveBeenCalled()
  })

  it("issue.reopen calls reopenIssue", async () => {
    const reopenIssue = vi.fn().mockResolvedValue({ reopened: true })
    const client = mockClient({ reopenIssue } as Partial<GithubClient>)
    const handler = requireHandler("issue.reopen")
    await handler(client, { owner: "acme", name: "repo", issueNumber: 1 })
    expect(reopenIssue).toHaveBeenCalled()
  })
})

// --- withDefaultFirst behavior (tested indirectly) ---

describe("withDefaultFirst (indirect via issue.list)", () => {
  it("adds first: 30 when not provided", async () => {
    const fetchIssueList = vi.fn().mockResolvedValue([])
    const client = mockClient({ fetchIssueList })
    const handler = requireHandler("issue.list")
    await handler(client, { owner: "acme", name: "repo" })
    expect(fetchIssueList).toHaveBeenCalledWith(expect.objectContaining({ first: 30 }))
  })

  it("preserves explicit first value", async () => {
    const fetchIssueList = vi.fn().mockResolvedValue([])
    const client = mockClient({ fetchIssueList })
    const handler = requireHandler("issue.list")
    await handler(client, { owner: "acme", name: "repo", first: 10 })
    expect(fetchIssueList).toHaveBeenCalledWith(expect.objectContaining({ first: 10 }))
  })

  it("adds first: 30 for pr.list when not provided", async () => {
    const fetchPrList = vi.fn().mockResolvedValue([])
    const client = mockClient({ fetchPrList })
    const handler = requireHandler("pr.list")
    await handler(client, { owner: "acme", name: "repo" })
    expect(fetchPrList).toHaveBeenCalledWith(expect.objectContaining({ first: 30 }))
  })
})

// --- project_v2.items.list defaults first to 30 ---

describe("project_v2.items.list default first", () => {
  it("defaults first to 30 when not provided", async () => {
    const fetchProjectV2ItemsList = vi.fn().mockResolvedValue([])
    const client = mockClient({ fetchProjectV2ItemsList })
    const handler = requireHandler("project_v2.items.list")
    await handler(client, { owner: "acme", projectNumber: 1 })
    expect(fetchProjectV2ItemsList).toHaveBeenCalledWith(expect.objectContaining({ first: 30 }))
  })

  it("preserves explicit first for project_v2.items.list", async () => {
    const fetchProjectV2ItemsList = vi.fn().mockResolvedValue([])
    const client = mockClient({ fetchProjectV2ItemsList })
    const handler = requireHandler("project_v2.items.list")
    await handler(client, { owner: "acme", projectNumber: 1, first: 50 })
    expect(fetchProjectV2ItemsList).toHaveBeenCalledWith(expect.objectContaining({ first: 50 }))
  })
})

// --- requireNonEmptyString (indirect via pr.threads.reply) ---

describe("requireNonEmptyString (indirect via pr.threads.reply)", () => {
  it("throws when threadId is empty", () => {
    const client = mockClient({ replyToReviewThread: vi.fn() })
    const handler = requireHandler("pr.threads.reply")
    expect(() => handler(client, { threadId: "", body: "LGTM" })).toThrow(
      "Missing or invalid threadId for pr.threads.reply",
    )
  })

  it("throws when body is empty", () => {
    const client = mockClient({ replyToReviewThread: vi.fn() })
    const handler = requireHandler("pr.threads.reply")
    expect(() => handler(client, { threadId: "T_1", body: "" })).toThrow(
      "Missing or invalid body for pr.threads.reply",
    )
  })

  it("throws when threadId is missing from pr.threads.resolve", () => {
    const client = mockClient({ resolveReviewThread: vi.fn() })
    const handler = requireHandler("pr.threads.resolve")
    expect(() => handler(client, {})).toThrow("Missing or invalid threadId for pr.threads.resolve")
  })
})

// --- pr.merge method normalization ---

describe("pr.merge method normalization", () => {
  it("normalizes lowercase method to uppercase mergeMethod", async () => {
    const mergePr = vi.fn().mockResolvedValue({ merged: true })
    const client = mockClient({ mergePr } as Partial<GithubClient>)
    const handler = requireHandler("pr.merge")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, method: "squash" })
    expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "SQUASH" }))
  })

  it("normalizes uppercase method to uppercase mergeMethod", async () => {
    const mergePr = vi.fn().mockResolvedValue({ merged: true })
    const client = mockClient({ mergePr } as Partial<GithubClient>)
    const handler = requireHandler("pr.merge")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1, method: "REBASE" })
    expect(mergePr).toHaveBeenCalledWith(expect.objectContaining({ mergeMethod: "REBASE" }))
  })

  it("rejects unsupported merge method", () => {
    const mergePr = vi.fn()
    const client = mockClient({ mergePr } as Partial<GithubClient>)
    const handler = requireHandler("pr.merge")
    expect(() =>
      handler(client, { owner: "acme", name: "repo", prNumber: 1, method: "invalid" }),
    ).toThrow('Unsupported merge method "invalid" for pr.merge')
  })

  it("omits mergeMethod when method is not provided", async () => {
    const mergePr = vi.fn().mockResolvedValue({ merged: true })
    const client = mockClient({ mergePr } as Partial<GithubClient>)
    const handler = requireHandler("pr.merge")
    await handler(client, { owner: "acme", name: "repo", prNumber: 1 })
    const call = mergePr.mock.calls[0] as unknown[]
    expect(call[0]).not.toHaveProperty("mergeMethod")
  })
})

// --- pr.create field remapping ---

describe("pr.create field remapping", () => {
  it("remaps head to headRefName and base to baseRefName", async () => {
    const createPr = vi.fn().mockResolvedValue({ number: 1 })
    const client = mockClient({ createPr } as Partial<GithubClient>)
    const handler = requireHandler("pr.create")
    await handler(client, {
      owner: "acme",
      name: "repo",
      title: "PR",
      head: "my-branch",
      base: "main",
    })
    expect(createPr).toHaveBeenCalledWith(
      expect.objectContaining({
        headRefName: "my-branch",
        baseRefName: "main",
      }),
    )
  })

  it("passes optional body and draft when provided", async () => {
    const createPr = vi.fn().mockResolvedValue({ number: 1 })
    const client = mockClient({ createPr } as Partial<GithubClient>)
    const handler = requireHandler("pr.create")
    await handler(client, {
      owner: "acme",
      name: "repo",
      title: "PR",
      head: "my-branch",
      base: "main",
      body: "Description",
      draft: true,
    })
    expect(createPr).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Description",
        draft: true,
      }),
    )
  })

  it("omits body and draft when not provided", async () => {
    const createPr = vi.fn().mockResolvedValue({ number: 1 })
    const client = mockClient({ createPr } as Partial<GithubClient>)
    const handler = requireHandler("pr.create")
    await handler(client, {
      owner: "acme",
      name: "repo",
      title: "PR",
      head: "my-branch",
      base: "main",
    })
    const call = createPr.mock.calls[0] as unknown[]
    expect(call[0]).not.toHaveProperty("body")
    expect(call[0]).not.toHaveProperty("draft")
  })
})
