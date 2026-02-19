import {
  handleRepoIssueTypesList,
  handleRepoLabelsList,
  handleRepoView,
} from "@core/core/execution/adapters/cli/domains/repo.js"
import type { CliCommandRunner } from "@core/core/execution/adapters/cli-adapter.js"
import { describe, expect, it, vi } from "vitest"

const mockRunner = (
  exitCode: number,
  stdout: string = "",
  stderr: string = "",
): CliCommandRunner => ({
  run: vi.fn().mockResolvedValue({ exitCode, stdout, stderr }),
})

describe("repo domain handlers", () => {
  describe("handleRepoView", () => {
    it("returns success with correct defaultBranch", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: "R_1",
          name: "test-repo",
          nameWithOwner: "owner/test-repo",
          isPrivate: false,
          stargazerCount: 42,
          forkCount: 10,
          url: "https://github.com/owner/test-repo",
          defaultBranchRef: { name: "main" },
        }),
      )

      const result = await handleRepoView(runner, { owner: "owner", name: "test-repo" }, undefined)

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        name: "test-repo",
        defaultBranch: "main",
      })
      expect(result.meta.capability_id).toBe("repo.view")
      expect(result.meta.route_used).toBe("cli")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "permission denied")

      const result = await handleRepoView(runner, { owner: "owner", name: "test-repo" }, undefined)

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("repo.view")
    })
  })

  describe("handleRepoLabelsList", () => {
    it("returns success with labels array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          { id: "L_1", name: "bug", description: "Bug report", color: "FF0000", isDefault: false },
          {
            id: "L_2",
            name: "feature",
            description: "Feature request",
            color: "00FF00",
            isDefault: false,
          },
        ]),
      )

      const result = await handleRepoLabelsList(
        runner,
        {
          owner: "owner",
          name: "test-repo",
          first: 30,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { name: "bug", color: "FF0000" },
          { name: "feature", color: "00FF00" },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
    })

    it("verifies call includes limit flag", async () => {
      const runSpy = vi.fn().mockResolvedValue({ exitCode: 0, stdout: "[]", stderr: "" })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleRepoLabelsList(
        runner,
        {
          owner: "owner",
          name: "test-repo",
          first: 50,
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["label", "list", "--limit", "50"]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "error fetching labels")

      const result = await handleRepoLabelsList(
        runner,
        {
          owner: "owner",
          name: "test-repo",
          first: 30,
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleRepoIssueTypesList", () => {
    it("returns success with issue types from GraphQL response", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          data: {
            repository: {
              issueTypes: {
                nodes: [
                  { id: "IT_1", name: "Bug", color: "FF0000", isEnabled: true },
                  { id: "IT_2", name: "Feature", color: "00FF00", isEnabled: true },
                ],
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
              },
            },
          },
        }),
      )

      const result = await handleRepoIssueTypesList(
        runner,
        {
          owner: "owner",
          name: "test-repo",
          first: 10,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: [
          { name: "Bug", isEnabled: true },
          { name: "Feature", isEnabled: true },
        ],
        pageInfo: { hasNextPage: false, endCursor: null },
      })
    })

    it("includes after cursor in GraphQL query when provided", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({
          data: { repository: { issueTypes: { nodes: [], pageInfo: {} } } },
        }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleRepoIssueTypesList(
        runner,
        {
          owner: "owner",
          name: "test-repo",
          first: 10,
          after: "cursor123",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["api", "graphql", "-f", "after=cursor123"]),
        expect.any(Number),
      )
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "graphql error")

      const result = await handleRepoIssueTypesList(
        runner,
        {
          owner: "owner",
          name: "test-repo",
          first: 10,
        },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })
})

describe("repo domain handlers – additional coverage", () => {
  describe("handleRepoView SyntaxError path", () => {
    it("returns error on malformed JSON", async () => {
      const result = await handleRepoView(
        mockRunner(0, "not-json"),
        { owner: "acme", name: "modkit" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("handles null defaultBranchRef gracefully", async () => {
      const result = await handleRepoView(
        mockRunner(
          0,
          JSON.stringify({
            id: "R_1",
            name: "modkit",
            nameWithOwner: "acme/modkit",
            isPrivate: false,
            stargazerCount: 0,
            forkCount: 0,
            url: "https://github.com/acme/modkit",
            defaultBranchRef: null,
          }),
        ),
        { owner: "acme", name: "modkit" },
        undefined,
      )
      expect(result.ok).toBe(true)
      expect((result.data as Record<string, unknown>).defaultBranch).toBeNull()
    })
  })

  describe("handleRepoLabelsList additional coverage", () => {
    it("returns error on malformed JSON", async () => {
      const result = await handleRepoLabelsList(
        mockRunner(0, "not-json"),
        { owner: "acme", name: "modkit", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("handles non-object label items gracefully", async () => {
      const result = await handleRepoLabelsList(
        mockRunner(0, JSON.stringify([null, "bad", 42])),
        { owner: "acme", name: "modkit", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(true)
      const items = (result.data as { items: unknown[] }).items
      expect(items).toHaveLength(3)
      expect(items[0]).toMatchObject({ id: null, name: null })
    })

    it("returns error for missing first param", async () => {
      const result = await handleRepoLabelsList(
        mockRunner(0, "[]"),
        { owner: "acme", name: "modkit", first: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
    })
  })

  describe("handleRepoIssueTypesList additional coverage", () => {
    it("returns error on malformed JSON", async () => {
      const result = await handleRepoIssueTypesList(
        mockRunner(0, "not-json"),
        { owner: "acme", name: "modkit", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("returns error for invalid after cursor type", async () => {
      const result = await handleRepoIssueTypesList(
        mockRunner(0, "{}"),
        { owner: "acme", name: "modkit", first: 30, after: 123 },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("returns error for missing owner", async () => {
      const result = await handleRepoIssueTypesList(
        mockRunner(0, "{}"),
        { owner: "", name: "modkit", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("handles non-object issue type nodes gracefully", async () => {
      const result = await handleRepoIssueTypesList(
        mockRunner(
          0,
          JSON.stringify({
            data: {
              repository: {
                issueTypes: {
                  nodes: [null, "bad", 42],
                  pageInfo: { hasNextPage: false, endCursor: null },
                },
              },
            },
          }),
        ),
        { owner: "acme", name: "modkit", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(true)
      const items = (result.data as { items: unknown[] }).items
      expect(items).toHaveLength(3)
      expect(items[0]).toMatchObject({ id: null, name: null, isEnabled: null })
    })
  })
})

describe("repo domain handlers – null owner/name ?? branch coverage", () => {
  const nr = () => mockRunner(1, "", "err")

  it("handleRepoView covers owner/name null branches", async () => {
    const result = await handleRepoView(nr(), { owner: null, name: null }, undefined)
    expect(result.ok).toBe(false)
  })

  it("handleRepoLabelsList covers owner/name null branches", async () => {
    const result = await handleRepoLabelsList(
      nr(),
      { owner: null, name: null, first: 30 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleRepoIssueTypesList covers owner/name null branches", async () => {
    const result = await handleRepoIssueTypesList(
      nr(),
      { owner: null, name: null, first: 10 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })
})
