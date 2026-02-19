import {
  handleReleaseCreateDraft,
  handleReleaseGet,
  handleReleaseList,
  handleReleasePublishDraft,
  handleReleaseUpdate,
  handlers,
} from "@core/core/execution/adapters/cli/domains/release.js"
import type { CliCommandRunner } from "@core/core/execution/adapters/cli-adapter.js"
import { describe, expect, it, vi } from "vitest"

const mockRunner = (
  exitCode: number,
  stdout: string = "",
  stderr: string = "",
): CliCommandRunner => ({
  run: vi.fn().mockResolvedValue({ exitCode, stdout, stderr }),
})

describe("release domain handlers", () => {
  describe("handleReleaseList", () => {
    it("returns success with items array", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify([
          {
            id: 123,
            tag_name: "v1.0.0",
            name: "Release 1.0.0",
            draft: false,
            prerelease: false,
            html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
            target_commitish: "main",
            created_at: "2024-01-01T00:00:00Z",
            published_at: "2024-01-01T00:00:00Z",
          },
          {
            id: 124,
            tag_name: "v1.0.1",
            name: "Release 1.0.1",
            draft: true,
            prerelease: false,
            html_url: "https://github.com/owner/repo/releases/tag/v1.0.1",
            target_commitish: "main",
            created_at: "2024-01-02T00:00:00Z",
            published_at: null,
          },
        ]),
      )

      const result = await handleReleaseList(
        runner,
        {
          owner: "owner",
          name: "repo",
          first: 30,
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        items: expect.any(Array),
        pageInfo: { hasNextPage: false, endCursor: null },
      })
      const items = (result.data as { items: Array<Record<string, unknown>> }).items
      expect(items).toHaveLength(2)
      expect(items[0]).toMatchObject({
        id: 123,
        tagName: "v1.0.0",
        name: "Release 1.0.0",
        isDraft: false,
        isPrerelease: false,
      })
      expect(items[1]).toMatchObject({
        id: 124,
        tagName: "v1.0.1",
        isDraft: true,
      })
      expect(result.meta.capability_id).toBe("release.list")
      expect(result.meta.route_used).toBe("cli")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "permission denied")

      const result = await handleReleaseList(
        runner,
        { owner: "owner", name: "repo", first: 30 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("release.list")
    })
  })

  describe("handleReleaseGet", () => {
    it("returns success with normalized release", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: 123,
          tag_name: "v1.0.0",
          name: "Release 1.0.0",
          draft: false,
          prerelease: false,
          html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
          target_commitish: "main",
          created_at: "2024-01-01T00:00:00Z",
          published_at: "2024-01-01T00:00:00Z",
        }),
      )

      const result = await handleReleaseGet(
        runner,
        { owner: "owner", name: "repo", tagName: "v1.0.0" },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        id: 123,
        tagName: "v1.0.0",
        name: "Release 1.0.0",
        isDraft: false,
        isPrerelease: false,
        url: "https://github.com/owner/repo/releases/tag/v1.0.0",
      })
      expect(result.meta.capability_id).toBe("release.get")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "not found")

      const result = await handleReleaseGet(
        runner,
        { owner: "owner", name: "repo", tagName: "v1.0.0" },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleReleaseCreateDraft", () => {
    it("returns success with normalized release", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: 123,
          tag_name: "v2.0.0",
          name: "Release 2.0.0",
          draft: true,
          prerelease: false,
          html_url: "https://github.com/owner/repo/releases/tag/v2.0.0",
          target_commitish: "develop",
          created_at: "2024-01-03T00:00:00Z",
          published_at: null,
        }),
      )

      const result = await handleReleaseCreateDraft(
        runner,
        {
          owner: "owner",
          name: "repo",
          tagName: "v2.0.0",
          title: "Release 2.0.0",
          targetCommitish: "develop",
        },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        id: 123,
        tagName: "v2.0.0",
        isDraft: true,
      })
      expect(result.meta.capability_id).toBe("release.create_draft")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "failed to create release")

      const result = await handleReleaseCreateDraft(
        runner,
        { owner: "owner", name: "repo", tagName: "v2.0.0" },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleReleaseUpdate", () => {
    it("returns success with normalized release", async () => {
      const runner = mockRunner(
        0,
        JSON.stringify({
          id: 123,
          tag_name: "v1.0.0",
          name: "Updated Release 1.0.0",
          draft: true,
          prerelease: false,
          html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
          target_commitish: "main",
          created_at: "2024-01-01T00:00:00Z",
          published_at: null,
        }),
      )

      const result = await handleReleaseUpdate(
        runner,
        { owner: "owner", name: "repo", releaseId: 123, title: "Updated Release 1.0.0" },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(result.data).toMatchObject({
        id: 123,
        name: "Updated Release 1.0.0",
        isDraft: true,
      })
      expect(result.meta.capability_id).toBe("release.update")
    })

    it("returns error when draft is false", async () => {
      const result = await handleReleaseUpdate(
        mockRunner(0),
        { owner: "owner", name: "repo", releaseId: 123, draft: false },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe("VALIDATION")
      expect(result.error?.message).toContain("only supports draft=true")
    })

    it("returns error on non-zero exit code", async () => {
      const runner = mockRunner(1, "", "failed to update release")

      const result = await handleReleaseUpdate(
        runner,
        { owner: "owner", name: "repo", releaseId: 123 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
    })
  })

  describe("handleReleasePublishDraft", () => {
    it("returns success with wasDraft flag after two calls", async () => {
      const runSpy = vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({
            id: 123,
            tag_name: "v1.0.0",
            name: "Release 1.0.0",
            draft: true,
            prerelease: false,
            html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
            target_commitish: "main",
            created_at: "2024-01-01T00:00:00Z",
            published_at: null,
          }),
          stderr: "",
        })
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({
            id: 123,
            tag_name: "v1.0.0",
            name: "Release 1.0.0",
            draft: false,
            prerelease: false,
            html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
            target_commitish: "main",
            created_at: "2024-01-01T00:00:00Z",
            published_at: "2024-01-15T00:00:00Z",
          }),
          stderr: "",
        })

      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await handleReleasePublishDraft(
        runner,
        { owner: "owner", name: "repo", releaseId: 123 },
        undefined,
      )

      expect(result.ok).toBe(true)
      expect(runSpy).toHaveBeenCalledTimes(2)
      expect(result.data).toMatchObject({
        id: 123,
        isDraft: false,
        wasDraft: true,
      })
      expect(result.meta.capability_id).toBe("release.publish_draft")
    })

    it("returns error when first read call fails", async () => {
      const runner = mockRunner(1, "", "not found")

      const result = await handleReleasePublishDraft(
        runner,
        { owner: "owner", name: "repo", releaseId: 123 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(result.meta.capability_id).toBe("release.publish_draft")
    })

    it("returns Validation error when release is not a draft", async () => {
      const runSpy = vi.fn().mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          id: 123,
          tag_name: "v1.0.0",
          name: "Release 1.0.0",
          draft: false,
          prerelease: false,
          html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
          target_commitish: "main",
          created_at: "2024-01-01T00:00:00Z",
          published_at: "2024-01-01T00:00:00Z",
        }),
        stderr: "",
      })

      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await handleReleasePublishDraft(
        runner,
        { owner: "owner", name: "repo", releaseId: 123 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBe("VALIDATION")
      expect(result.error?.message).toContain("requires an existing draft release")
      expect(runSpy).toHaveBeenCalledTimes(1)
    })

    it("returns error when publish call fails", async () => {
      const runSpy = vi
        .fn()
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({
            id: 123,
            tag_name: "v1.0.0",
            name: "Release 1.0.0",
            draft: true,
            prerelease: false,
            html_url: "https://github.com/owner/repo/releases/tag/v1.0.0",
            target_commitish: "main",
            created_at: "2024-01-01T00:00:00Z",
            published_at: null,
          }),
          stderr: "",
        })
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: "",
          stderr: "failed to publish release",
        })

      const runner = { run: runSpy } as unknown as CliCommandRunner

      const result = await handleReleasePublishDraft(
        runner,
        { owner: "owner", name: "repo", releaseId: 123 },
        undefined,
      )

      expect(result.ok).toBe(false)
      expect(result.error?.code).toBeDefined()
      expect(runSpy).toHaveBeenCalledTimes(2)
    })
  })

  describe("handlers export", () => {
    it("exports all release handlers", () => {
      expect(handlers["release.list"]).toBe(handleReleaseList)
      expect(handlers["release.get"]).toBe(handleReleaseGet)
      expect(handlers["release.create_draft"]).toBe(handleReleaseCreateDraft)
      expect(handlers["release.update"]).toBe(handleReleaseUpdate)
      expect(handlers["release.publish_draft"]).toBe(handleReleasePublishDraft)
    })
  })
})

describe("release domain handlers – additional coverage", () => {
  describe("requireRepo failures", () => {
    it("release.list returns error for missing owner", async () => {
      const result = await handleReleaseList(
        mockRunner(0, "[]"),
        { owner: "", name: "repo", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("owner/name")
    })

    it("release.get returns error for missing name", async () => {
      const result = await handleReleaseGet(
        mockRunner(0, "{}"),
        { owner: "acme", name: "", tagName: "v1.0.0" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("owner/name")
    })

    it("release.create_draft returns error for missing owner", async () => {
      const result = await handleReleaseCreateDraft(
        mockRunner(0, "{}"),
        { owner: "", name: "repo", tagName: "v1.0.0" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("owner/name")
    })

    it("release.update returns error for missing owner", async () => {
      const result = await handleReleaseUpdate(
        mockRunner(0, "{}"),
        { owner: "", name: "repo", releaseId: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("owner/name")
    })

    it("release.publish_draft returns error for missing owner", async () => {
      const result = await handleReleasePublishDraft(
        mockRunner(0, "{}"),
        { owner: "", name: "repo", releaseId: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("owner/name")
    })
  })

  describe("SyntaxError paths", () => {
    it("release.list returns error on malformed JSON", async () => {
      const result = await handleReleaseList(
        mockRunner(0, "not-json"),
        { owner: "acme", name: "repo", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("release.get returns error on malformed JSON", async () => {
      const result = await handleReleaseGet(
        mockRunner(0, "not-json"),
        { owner: "acme", name: "repo", tagName: "v1.0.0" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("release.create_draft returns error on malformed JSON", async () => {
      const result = await handleReleaseCreateDraft(
        mockRunner(0, "not-json"),
        { owner: "acme", name: "repo", tagName: "v1.0.0" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("release.update returns error on malformed JSON", async () => {
      const result = await handleReleaseUpdate(
        mockRunner(0, "not-json"),
        { owner: "acme", name: "repo", releaseId: 1, title: "Updated" },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })

    it("release.publish_draft returns error on malformed JSON in read step", async () => {
      const result = await handleReleasePublishDraft(
        mockRunner(0, "not-json"),
        { owner: "acme", name: "repo", releaseId: 1 },
        undefined,
      )
      expect(result.ok).toBe(false)
      expect(result.error?.message).toContain("Failed to parse CLI JSON output")
    })
  })

  describe("missing required params", () => {
    it("release.get returns error for missing tagName", async () => {
      const result = await handleReleaseGet(
        mockRunner(0, "{}"),
        { owner: "acme", name: "repo", tagName: "" },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("release.update returns error for missing releaseId", async () => {
      const result = await handleReleaseUpdate(
        mockRunner(0, "{}"),
        { owner: "acme", name: "repo", releaseId: 0, title: "x" },
        undefined,
      )
      expect(result.ok).toBe(false)
    })

    it("release.publish_draft returns error for missing releaseId", async () => {
      const result = await handleReleasePublishDraft(
        mockRunner(0, "{}"),
        { owner: "acme", name: "repo", releaseId: 0 },
        undefined,
      )
      expect(result.ok).toBe(false)
    })
  })

  describe("optional params in create_draft", () => {
    it("includes notes and prerelease when provided", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ tag_name: "v1.0.0", draft: true }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleReleaseCreateDraft(
        runner,
        {
          owner: "acme",
          name: "repo",
          tagName: "v1.0.0",
          notes: "Release notes here",
          prerelease: true,
          targetCommitish: "main",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["body=Release notes here"]),
        expect.any(Number),
      )
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["prerelease=true"]),
        expect.any(Number),
      )
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["target_commitish=main"]),
        expect.any(Number),
      )
    })
  })

  describe("optional params in update", () => {
    it("includes tagName, notes and prerelease when provided", async () => {
      const runSpy = vi.fn().mockResolvedValue({
        exitCode: 0,
        stdout: JSON.stringify({ tag_name: "v1.0.1", draft: true }),
        stderr: "",
      })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleReleaseUpdate(
        runner,
        {
          owner: "acme",
          name: "repo",
          releaseId: 42,
          tagName: "v1.0.1",
          notes: "Updated notes",
          prerelease: false,
          targetCommitish: "dev",
        },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["tag_name=v1.0.1"]),
        expect.any(Number),
      )
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["body=Updated notes"]),
        expect.any(Number),
      )
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["prerelease=false"]),
        expect.any(Number),
      )
      expect(runSpy).toHaveBeenCalledWith(
        "gh",
        expect.arrayContaining(["target_commitish=dev"]),
        expect.any(Number),
      )
    })
  })

  describe("normalizeRelease with null/non-object input", () => {
    it("release.list handles non-object entries in array", async () => {
      const result = await handleReleaseList(
        mockRunner(0, JSON.stringify([null, "bad", 42])),
        { owner: "acme", name: "repo", first: 30 },
        undefined,
      )
      expect(result.ok).toBe(true)
      const items = (result.data as { items: unknown[] }).items
      expect(items).toHaveLength(3)
      expect(items[0]).toMatchObject({ id: 0, tagName: null })
    })
  })

  describe("release.publish_draft – optional params and non-draft guard", () => {
    it("includes notes, prerelease in publish call when provided", async () => {
      const runSpy = vi
        .fn()
        .mockResolvedValueOnce({ exitCode: 0, stdout: JSON.stringify({ draft: true }), stderr: "" })
        .mockResolvedValueOnce({
          exitCode: 0,
          stdout: JSON.stringify({ tag_name: "v1.0.0", draft: false }),
          stderr: "",
        })
      const runner = { run: runSpy } as unknown as CliCommandRunner

      await handleReleasePublishDraft(
        runner,
        { owner: "acme", name: "repo", releaseId: 1, notes: "Final notes", prerelease: false },
        undefined,
      )

      expect(runSpy).toHaveBeenCalledTimes(2)
      expect(runSpy).toHaveBeenNthCalledWith(
        2,
        "gh",
        expect.arrayContaining(["body=Final notes"]),
        expect.any(Number),
      )
    })
  })
})

describe("release domain handlers – null owner/name ?? branch coverage", () => {
  const nr = () => mockRunner(1, "", "err")

  it("handleReleaseList covers owner/name null branches", async () => {
    const result = await handleReleaseList(nr(), { owner: null, name: null, first: 30 }, undefined)
    expect(result.ok).toBe(false)
  })

  it("handleReleaseGet covers owner/name null branches", async () => {
    const result = await handleReleaseGet(
      nr(),
      { owner: null, name: null, tagName: "v1.0.0" },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleReleaseCreateDraft covers owner/name null branches", async () => {
    const result = await handleReleaseCreateDraft(
      nr(),
      { owner: null, name: null, tagName: "v1.0.0" },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleReleaseUpdate covers owner/name null branches", async () => {
    const result = await handleReleaseUpdate(
      nr(),
      { owner: null, name: null, releaseId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })

  it("handleReleasePublishDraft covers owner/name null branches", async () => {
    const result = await handleReleasePublishDraft(
      nr(),
      { owner: null, name: null, releaseId: 1 },
      undefined,
    )
    expect(result.ok).toBe(false)
  })
})
