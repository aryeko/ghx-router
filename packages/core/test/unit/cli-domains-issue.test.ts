import {
  handleIssueAssigneesAdd,
  handleIssueAssigneesRemove,
  handleIssueCommentsList,
  handleIssueLabelsRemove,
  handleIssueList,
  handleIssueMilestoneClear,
  handleIssueView,
} from "@core/core/execution/adapters/cli/domains/issue.js"
import type { CliCommandRunner } from "@core/core/execution/adapters/cli-adapter.js"
import { describe, expect, it, vi } from "vitest"

const mockRunner = (
  exitCode: number,
  stdout: string = "",
  stderr: string = "",
): CliCommandRunner => ({
  run: vi.fn().mockResolvedValue({ exitCode, stdout, stderr }),
})

describe("issue domain handlers", () => {
  describe("handleIssueView", () => {
    it("returns success with normalized fields", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: "I_1",
          number: 42,
          title: "Test issue",
          state: "OPEN",
          url: "https://github.com/owner/repo/issues/42",
          body: "Issue body",
          labels: [{ name: "bug" }, { name: "enhancement" }],
        }),
      )

      const result = await handleIssueView(
        runner,
        { owner: "owner", name: "repo", issueNumber: 42 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        number: 42,
        title: "Test issue",
        body: "Issue body",
        labels: ["bug", "enhancement"],
      })
      expect(result.meta.capability_id).toBe("issue.view")
      expect(result.meta.route_used).toBe("cli")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "not found")

      const result = await handleIssueView(
        runner,
        { owner: "owner", name: "repo", issueNumber: 42 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("issue.view")
    })

    it("returns error for invalid issueNumber", async () => {
      const runner = mockRunner(0, "{}")

      const result = await handleIssueView(
        runner,
        { owner: "owner", name: "repo", issueNumber: "not-a-number" },
        undefined,
      )

      expect(result.ok).toBe(false)
    })
  })

  describe("handleIssueList", () => {
    it("returns success with items array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            id: "I_1",
            number: 1,
            title: "First",
            state: "OPEN",
            url: "https://github.com/o/r/issues/1",
          },
          {
            id: "I_2",
            number: 2,
            title: "Second",
            state: "CLOSED",
            url: "https://github.com/o/r/issues/2",
          },
        ]),
      )

      const result = await handleIssueList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { number: 1, title: "First" },
          { number: 2, title: "Second" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
    })

    it("verifies call includes limit flag", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleIssueList(runner, { owner: "owner", name: "repo", first: 50 }, undefined)

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["issue", "list", "--limit", "50"]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "error fetching issues")

      const result = await handleIssueList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleIssueCommentsList", () => {
    it("returns success with comments from GraphQL response", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [
                    {
                      id: "IC_1",
                      body: "First comment",
                      createdAt: "2024-01-01T00:00:00Z",
                      url: "https://github.com/owner/repo/issues/42#issuecomment-1",
                      author: { login: "user1" },
                    },
                  ],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          },
        }),
      )

      const result = await handleIssueCommentsList(
        runner,
        { owner: "owner", name: "repo", issueNumber: 42, first: 10 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [{ body: "First comment", authorLogin: "user1" }],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
      expect(result.meta.capability_id).toBe("issue.comments.list")
    })

    it("returns server error for malformed GraphQL payload", async () => {
      const runner = mockRunner(0, JSON.stringify({ data: {} }))

      const result = await handleIssueCommentsList(
        runner,
        { owner: "owner", name: "repo", issueNumber: 42, first: 10 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns validation error for invalid after cursor type", async () => {
      const runner = mockRunner(0, "{}")

      const result = await handleIssueCommentsList(
        runner,
        { owner: "owner", name: "repo", issueNumber: 42, first: 10, after: 12345 },
        undefined,
      )

      expect(result.ok).toBe(false)
    })

    it("includes after cursor in GraphQL query when provided", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          data: {
            repository: {
              issue: {
                comments: {
                  nodes: [],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          },
        }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleIssueCommentsList(
        runner,
        { owner: "owner", name: "repo", issueNumber: 42, first: 10, after: "cursor456" },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["api", "graphql", "-f", "after=cursor456"]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "graphql error")

      const result = await handleIssueCommentsList(
        runner,
        { owner: "owner", name: "repo", issueNumber: 42, first: 10 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })
})

describe("issue domain handlers – additional coverage", () => {
  describe("handleIssueView SyntaxError path", () => {
    it("returns error on malformed JSON", async () => {
      const result = await handleIssueView(
        mockRunner(0, "not-json"),
        { owner: "owner", name: "repo", issueNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("returns success with empty body when response is a JSON array", async () => {
      const result = await handleIssueView(
        mockRunner(0, "[1,2,3]"),
        { owner: "owner", name: "repo", issueNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect((result.data as Record<string, unknown>).body).toBe("")
    })

    it("filters out non-object label items", async () => {
      const result = await handleIssueView(
        mockRunner(
          0,
          JSON.stringify({
            id: "I_1",
            number: 1,
            title: "T",
            state: "OPEN",
            url: "http://x",
            labels: ["string-label", null, 42],
          }),
        ),
        { owner: "owner", name: "repo", issueNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect((result.data as { labels: unknown[] }).labels).toHaveLength(0)
    })
  })

  describe("handleIssueList SyntaxError path", () => {
    it("returns error on malformed JSON", async () => {
      const result = await handleIssueList(
        mockRunner(0, "not-json"),
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("returns error for missing first param", async () => {
      const result = await handleIssueList(
        mockRunner(0, "[]"),
        { owner: "owner", name: "repo", first: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
    })
  })

  describe("handleIssueCommentsList first=0 path", () => {
    it("returns error when first is zero", async () => {
      const result = await handleIssueCommentsList(
        mockRunner(0, "{}"),
        { owner: "owner", name: "repo", issueNumber: 1, first: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("first")
    })
  })

  describe("handleIssueCommentsList additional coverage", () => {
    it("returns error on malformed JSON", async () => {
      const result = await handleIssueCommentsList(
        mockRunner(0, "not-json"),
        { owner: "owner", name: "repo", issueNumber: 1, first: 10 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("returns error when owner is empty", async () => {
      const result = await handleIssueCommentsList(
        mockRunner(0, "{}"),
        { owner: "", name: "repo", issueNumber: 1, first: 10 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Missing owner/name")
    })

    it("returns error when name is empty", async () => {
      const result = await handleIssueCommentsList(
        mockRunner(0, "{}"),
        { owner: "owner", name: "", issueNumber: 1, first: 10 },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("returns server error for non-object comment item", async () => {
      const result = await handleIssueCommentsList(
        mockRunner(
          0,
          JSON.stringify({
            data: {
              repository: {
                issue: {
                  comments: {
                    nodes: ["not-an-object"],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                },
              },
            },
          }),
        ),
        { owner: "owner", name: "repo", issueNumber: 1, first: 10 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Invalid CLI payload")
    })

    it("returns server error for comment with invalid field types", async () => {
      const result = await handleIssueCommentsList(
        mockRunner(
          0,
          JSON.stringify({
            data: {
              repository: {
                issue: {
                  comments: {
                    nodes: [{ id: 123, body: null, url: null, createdAt: null }],
                    pageInfo: { hasNextPage: false, endCursor: null },
                  },
                },
              },
            },
          }),
        ),
        { owner: "owner", name: "repo", issueNumber: 1, first: 10 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Invalid CLI payload")
    })
  })
})

describe("issue domain handlers – new capabilities", () => {
  describe("handleIssueLabelsRemove", () => {
    it("returns success with removed labels", async () => {
      const result = await handleIssueLabelsRemove(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 42, labels: ["bug", "wontfix"] },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({ issueNumber: 42, removed: ["bug", "wontfix"] })
      expect(result.meta.capability_id).toBe("issue.labels.remove")
      expect(result.meta.route_used).toBe("cli")
    })

    it("returns error for invalid issueNumber", async () => {
      const result = await handleIssueLabelsRemove(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 0, labels: ["bug"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("issueNumber")
    })

    it("returns error for empty labels array", async () => {
      const result = await handleIssueLabelsRemove(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 1, labels: [] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("labels")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await handleIssueLabelsRemove(
        mockRunner(1, "", "label not found"),
        { owner: "owner", name: "repo", issueNumber: 1, labels: ["missing"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error when runner throws", async () => {
      const runner = {
        run: vi.fn().mockRejectedValue(new Error("timeout")),
      } as unknown as CliCommandRunner

      const result = await handleIssueLabelsRemove(
        runner,
        { owner: "owner", name: "repo", issueNumber: 1, labels: ["bug"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("timeout")
    })
  })

  describe("handleIssueAssigneesAdd", () => {
    it("returns success with added assignees", async () => {
      const result = await handleIssueAssigneesAdd(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 7, assignees: ["alice", "bob"] },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({ issueNumber: 7, added: ["alice", "bob"] })
      expect(result.meta.capability_id).toBe("issue.assignees.add")
    })

    it("returns error for invalid issueNumber", async () => {
      const result = await handleIssueAssigneesAdd(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: -1, assignees: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("issueNumber")
    })

    it("returns error for empty assignees array", async () => {
      const result = await handleIssueAssigneesAdd(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 1, assignees: [] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("assignees")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await handleIssueAssigneesAdd(
        mockRunner(1, "", "user not found"),
        { owner: "owner", name: "repo", issueNumber: 1, assignees: ["ghost"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error when runner throws", async () => {
      const runner = {
        run: vi.fn().mockRejectedValue(new Error("network error")),
      } as unknown as CliCommandRunner

      const result = await handleIssueAssigneesAdd(
        runner,
        { owner: "owner", name: "repo", issueNumber: 1, assignees: ["alice"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("network error")
    })
  })

  describe("handleIssueAssigneesRemove", () => {
    it("returns success with removed assignees", async () => {
      const result = await handleIssueAssigneesRemove(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 5, assignees: ["carol"] },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({ issueNumber: 5, removed: ["carol"] })
      expect(result.meta.capability_id).toBe("issue.assignees.remove")
    })

    it("returns error for invalid issueNumber", async () => {
      const result = await handleIssueAssigneesRemove(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 0, assignees: ["carol"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("issueNumber")
    })

    it("returns error for empty assignees array", async () => {
      const result = await handleIssueAssigneesRemove(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 1, assignees: [] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("assignees")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await handleIssueAssigneesRemove(
        mockRunner(1, "", "permission denied"),
        { owner: "owner", name: "repo", issueNumber: 1, assignees: ["carol"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error when runner throws", async () => {
      const runner = {
        run: vi.fn().mockRejectedValue(new Error("runner failure")),
      } as unknown as CliCommandRunner

      const result = await handleIssueAssigneesRemove(
        runner,
        { owner: "owner", name: "repo", issueNumber: 1, assignees: ["carol"] },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("runner failure")
    })
  })

  describe("handleIssueMilestoneClear", () => {
    it("returns success with cleared: true", async () => {
      const result = await handleIssueMilestoneClear(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 3 },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({ issueNumber: 3, cleared: true })
      expect(result.meta.capability_id).toBe("issue.milestone.clear")
      expect(result.meta.route_used).toBe("cli")
    })

    it("returns error for invalid issueNumber", async () => {
      const result = await handleIssueMilestoneClear(
        mockRunner(0, ""),
        { owner: "owner", name: "repo", issueNumber: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("issueNumber")
    })

    it("returns error on non-zero exit code", async () => {
      const result = await handleIssueMilestoneClear(
        mockRunner(1, "", "issue not found"),
        { owner: "owner", name: "repo", issueNumber: 99 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })

    it("returns error when runner throws", async () => {
      const runner = {
        run: vi.fn().mockRejectedValue(new Error("timeout")),
      } as unknown as CliCommandRunner

      const result = await handleIssueMilestoneClear(
        runner,
        { owner: "owner", name: "repo", issueNumber: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("timeout")
    })
  })
})
