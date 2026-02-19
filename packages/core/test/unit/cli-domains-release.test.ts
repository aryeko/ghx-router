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
