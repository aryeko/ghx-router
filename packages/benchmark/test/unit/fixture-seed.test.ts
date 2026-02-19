import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { beforeEach, describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}))

import { seedFixtureManifest } from "@bench/fixture/seed.js"

function success(stdout: unknown): { status: number; stdout: string; stderr: string } {
  return {
    status: 0,
    stdout: typeof stdout === "string" ? stdout : JSON.stringify(stdout),
    stderr: "",
  }
}

describe("fixture seed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates missing PR, thread, and project artifacts", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (
        joined.includes("label create bench-fixture") ||
        joined.includes("label create bench-seed:seedtest")
      ) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([])
      }

      if (joined.includes("repos/aryeko/ghx-bench-fixtures/issues --method POST")) {
        return success({
          id: 12345,
          number: 42,
          html_url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
        })
      }

      if (joined.includes("issue view 42 --repo aryeko/ghx-bench-fixtures --json id,number,url")) {
        return success({
          id: "I_seed",
          number: 42,
          url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
        })
      }

      if (joined.includes("pr list") && joined.includes("--state open")) {
        return success([])
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/git/ref/heads/main")) {
        return success({ object: { sha: "base123" } })
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/git/refs --method POST")) {
        return success({})
      }

      if (
        joined.includes(
          "api repos/aryeko/ghx-bench-fixtures/contents/.bench/seed-seedtest.md --method PUT",
        )
      ) {
        return success({})
      }

      if (joined.includes("repos/aryeko/ghx-bench-fixtures/pulls --method POST")) {
        return success({ node_id: "PR_seed", number: 17, head: { sha: "abc123" } })
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        return success({
          data: {
            repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
          },
        })
      }

      if (joined.includes("run list") || joined.includes("run view")) {
        if (joined.includes("run list") && joined.includes("databaseId,displayTitle,createdAt")) {
          return success([
            {
              databaseId: 555,
              displayTitle: "bench-rerun-failed seedtest",
              createdAt: "2024-01-01T00:00:00.000Z",
            },
          ])
        }

        if (joined.includes("run view 555") && joined.includes("--json status,conclusion")) {
          return success({ status: "completed", conclusion: "failure" })
        }

        if (joined.includes("run view 555") && joined.includes("--json jobs")) {
          return success({ jobs: [{ databaseId: 777, conclusion: "failure" }] })
        }

        return success([])
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/releases?per_page=20")) {
        return success([])
      }

      if (joined.includes("project list --owner aryeko --format json")) {
        return success([{ id: "PVT_existing", number: 4, title: "planpilot roadmap" }])
      }

      if (
        joined.includes("project create --owner aryeko --title") &&
        joined.includes("--format json")
      ) {
        return success({ id: "PVT_seed", number: 9 })
      }

      if (
        joined.includes("project item-add 9 --owner aryeko") &&
        joined.includes("/issues/42") &&
        joined.includes("--format json")
      ) {
        return success({ id: "PVTI_seed" })
      }

      if (joined.includes("project field-list 9 --owner aryeko --format json")) {
        return success({
          fields: [
            {
              id: "PVTSSF_seed",
              name: "Status",
              type: "ProjectV2SingleSelectField",
              options: [{ id: "todo_option", name: "Todo" }],
            },
          ],
        })
      }

      return success({})
    })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-"))
    const outFile = join(root, "fixture.json")

    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
    })

    expect(manifest.resources.pr).toMatchObject({ id: "PR_seed", number: 17 })
    expect(manifest.resources.pr_thread).toMatchObject({ id: "PRRT_seed" })
    expect(manifest.resources.project).toMatchObject({
      id: "PVT_seed",
      number: 9,
      item_id: "PVTI_seed",
      field_id: "PVTSSF_seed",
      option_id: "todo_option",
    })

    const persisted = JSON.parse(await readFile(outFile, "utf8"))
    expect(persisted.resources.pr.number).toBe(17)
  })

  it("rejects invalid repo format", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-invalid-repo-"))
    const outFile = join(root, "fixture.json")

    await expect(
      seedFixtureManifest({
        repo: "invalid-repo",
        outFile,
        seedId: "seedtest",
      }),
    ).rejects.toThrow("invalid repo format: invalid-repo; expected owner/name")
  })

  it("rejects repo format with extra path segments", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-invalid-repo-extra-"))
    const outFile = join(root, "fixture.json")

    await expect(
      seedFixtureManifest({
        repo: "owner/repo/extra",
        outFile,
        seedId: "seedtest",
      }),
    ).rejects.toThrow("invalid repo format: owner/repo/extra; expected owner/name")
  })

  it("rejects empty output file path", async () => {
    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "",
        seedId: "seedtest",
      }),
    ).rejects.toThrow("seed outFile must be a non-empty path")
  })

  it("rejects empty seed id", async () => {
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-empty-seed-id-"))
    const outFile = join(root, "fixture.json")

    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile,
        seedId: "",
      }),
    ).rejects.toThrow("seedId must be a non-empty string")
  })

  it("throws fallback gh error text when gh fails without stderr", async () => {
    spawnSyncMock.mockReturnValue({ status: 1, stdout: "", stderr: "" })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-gh-fail-"))
    const outFile = join(root, "fixture.json")

    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile,
        seedId: "seedtest",
      }),
    ).rejects.toThrow(
      "gh command failed: gh label create bench-fixture --repo aryeko/ghx-bench-fixtures --color 5319E7 --force",
    )
  })

  it("falls back to latest workflow run and placeholder project fixture values", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (
        joined.includes("label create bench-fixture") ||
        joined.includes("label create bench-seed:seedtest")
      ) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([
          {
            id: "I_seed",
            number: 42,
            url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          },
        ])
      }

      if (
        joined.includes("pr list") &&
        joined.includes("--label bench-seed:seedtest") &&
        joined.includes("--json id,number")
      ) {
        return success([{ id: "PR_seed", number: 17 }])
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        return success({
          data: {
            repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
          },
        })
      }

      if (joined.includes("workflow run bench-rerun-failed.yml")) {
        return { status: 1, stdout: "", stderr: "dispatch failed" }
      }

      if (joined.includes("pr checks 17") && joined.includes("--json state,link")) {
        return success({
          items: [
            {
              state: "FAILURE",
              link: "https://github.com/aryeko/ghx-bench-fixtures/actions/runs/999",
            },
          ],
        })
      }

      if (joined.includes("run view 999") && joined.includes("--json jobs")) {
        return success({
          jobs: [
            {
              databaseId: 333,
              checkRunUrl: "https://api.github.com/repos/aryeko/ghx-bench-fixtures/check-runs/444",
            },
          ],
        })
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/releases?per_page=20")) {
        return success([])
      }

      if (joined.includes("project list --owner aryeko --format json")) {
        return { status: 1, stdout: "", stderr: "project unavailable" }
      }

      return success({})
    })

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-fallbacks-"))
    const outFile = join(root, "fixture.json")

    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
    })

    expect(manifest.resources.workflow_run).toMatchObject({ id: 999 })
    expect(manifest.resources.workflow_job).toMatchObject({ id: 333 })
    expect(manifest.resources.check_run).toMatchObject({ id: 444 })
    expect(manifest.resources.project).toMatchObject({
      number: 1,
      id: "",
      item_id: "",
      field_id: "",
      option_id: "",
    })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("warning: unable to seed project fixture"),
    )
  })

  it("throws when creating PR and base sha cannot be resolved", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (
        joined.includes("label create bench-fixture") ||
        joined.includes("label create bench-seed:seedtest")
      ) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([
          {
            id: "I_seed",
            number: 42,
            url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          },
        ])
      }

      if (
        joined.includes("pr list") &&
        joined.includes("--label bench-seed:seedtest") &&
        joined.includes("--json id,number")
      ) {
        return success([])
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/git/ref/heads/main")) {
        return success({ object: { sha: "" } })
      }

      return success({})
    })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-sha-"))
    const outFile = join(root, "fixture.json")

    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile,
        seedId: "seedtest",
      }),
    ).rejects.toThrow("unable to resolve base sha for fixture PR creation")
  })

  it("reuses existing branch PR and creates thread from a review comment when missing", async () => {
    let graphqlCalls = 0

    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (
        joined.includes("label create bench-fixture") ||
        joined.includes("label create bench-seed:seedtest")
      ) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success({
          items: [
            {
              id: "I_seed",
              number: 42,
              url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
            },
          ],
        })
      }

      if (
        joined.includes("pr list") &&
        joined.includes("--label bench-seed:seedtest") &&
        joined.includes("--json id,number")
      ) {
        return success([])
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/git/ref/heads/main")) {
        return success({ object: { sha: "base123" } })
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/git/refs --method POST")) {
        return success({})
      }

      if (
        joined.includes(
          "api repos/aryeko/ghx-bench-fixtures/contents/.bench/seed-seedtest.md --method PUT",
        )
      ) {
        return success({})
      }

      if (joined.includes("pr list") && joined.includes("--head bench-seed-seedtest")) {
        return success([{ id: "PR_existing", number: 25 }])
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        graphqlCalls += 1
        if (graphqlCalls === 1) {
          return success({
            data: { repository: { pullRequest: { reviewThreads: { nodes: [] } } } },
          })
        }
        return success({
          data: {
            repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
          },
        })
      }

      if (joined.includes("pr view 25") && joined.includes("--json headRefOid")) {
        return success({ headRefOid: "deadbeef" })
      }

      if (joined.includes("/pulls/25/comments --method POST")) {
        return success({})
      }

      if (joined.includes("workflow run bench-rerun-failed.yml")) {
        return success("")
      }

      if (joined.includes("run list") && joined.includes("databaseId,displayTitle,createdAt")) {
        return success([
          {
            databaseId: 444,
            displayTitle: "some-other-workflow-title",
            createdAt: new Date().toISOString(),
          },
        ])
      }

      if (joined.includes("run view 444") && joined.includes("--json status,conclusion")) {
        return success({ status: "completed", conclusion: "failure" })
      }

      if (joined.includes("run view 444") && joined.includes("--json jobs")) {
        return success({
          jobs: [
            {
              databaseId: 900,
              checkRunUrl: "https://api.github.com/repos/aryeko/ghx-bench-fixtures/check-runs/901",
              conclusion: "success",
            },
          ],
        })
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/releases?per_page=20")) {
        return success([{ draft: true, id: 321, tag_name: "v9.9.9-draft" }])
      }

      if (joined.includes("project list --owner aryeko --format json")) {
        return success({
          projects: [{ id: "PVT_existing", number: 4, title: "GHX Bench Fixtures" }],
        })
      }

      if (joined.includes("project item-add 4 --owner aryeko")) {
        return { status: 1, stdout: "", stderr: "item add failed" }
      }

      if (joined.includes("project field-list 4 --owner aryeko --format json")) {
        return success({
          fields: [
            {
              id: "field-1",
              type: "ProjectV2SingleSelectField",
              options: [{ id: 42 }],
            },
          ],
        })
      }

      return success({})
    })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-reuse-pr-"))
    const outFile = join(root, "fixture.json")

    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
    })

    expect(manifest.resources.pr).toMatchObject({ id: "PR_existing", number: 25 })
    expect(manifest.resources.pr_thread).toMatchObject({ id: "PRRT_seed" })
    expect(manifest.resources.workflow_run).toMatchObject({ id: 444 })
    expect(manifest.resources.workflow_job).toMatchObject({ id: 900 })
    expect(manifest.resources.check_run).toMatchObject({ id: 901 })
    expect(manifest.resources.release).toMatchObject({ id: 321, tag_name: "v9.9.9-draft" })
    expect(manifest.resources.project).toMatchObject({
      number: 4,
      id: "PVT_existing",
      item_id: "",
      field_id: "",
      option_id: "",
    })
  })

  it("uses workflow and release defaults when rerun fails and no fallback run is found", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (
        joined.includes("label create bench-fixture") ||
        joined.includes("label create bench-seed:seedtest")
      ) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([
          {
            id: "I_seed",
            number: 42,
            url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          },
        ])
      }

      if (
        joined.includes("pr list") &&
        joined.includes("--label bench-seed:seedtest") &&
        joined.includes("--json id,number")
      ) {
        return success([{ id: "PR_seed", number: 17 }])
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        return success({
          data: {
            repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
          },
        })
      }

      if (joined.includes("workflow run bench-rerun-failed.yml")) {
        return success("")
      }

      if (joined.includes("run list") && joined.includes("databaseId,displayTitle,createdAt")) {
        return success([
          {
            databaseId: 555,
            displayTitle: "bench-rerun-failed seedtest",
            createdAt: new Date().toISOString(),
          },
        ])
      }

      if (joined.includes("run view 555") && joined.includes("--json status,conclusion")) {
        return success({ status: "completed", conclusion: "success" })
      }

      if (joined.includes("pr checks 17") && joined.includes("--json state,link")) {
        return success({})
      }

      if (joined.includes("run list --repo aryeko/ghx-bench-fixtures --workflow ci.yml")) {
        return success([])
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/releases?per_page=20")) {
        return success([])
      }

      if (joined.includes("project list --owner aryeko --format json")) {
        return success([{ id: "PVT_existing", number: 4, title: "GHX Bench Fixtures" }])
      }

      if (joined.includes("project item-add 4 --owner aryeko")) {
        return success({ id: "PVTI_seed" })
      }

      if (joined.includes("project field-list 4 --owner aryeko --format json")) {
        return success([])
      }

      return success({})
    })

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-default-workflow-"))
    const outFile = join(root, "fixture.json")

    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
    })

    expect(manifest.resources.workflow_run).toMatchObject({ id: 1 })
    expect(manifest.resources.workflow_job).toMatchObject({ id: 1 })
    expect(manifest.resources.check_run).toMatchObject({ id: 1 })
    expect(manifest.resources.release).toMatchObject({ id: 1, tag_name: "v0.0.0-bench" })
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("warning: failed rerun fixture workflow unavailable"),
    )
  })

  it("throws when fixture issue creation fails", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (
        joined.includes("label create bench-fixture") ||
        joined.includes("label create bench-seed:seedtest")
      ) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([{}])
      }

      if (joined.includes("repos/aryeko/ghx-bench-fixtures/issues --method POST")) {
        return success({ number: 0 })
      }

      return success({})
    })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-issue-fail-"))
    const outFile = join(root, "fixture.json")

    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile,
        seedId: "seedtest",
      }),
    ).rejects.toThrow("failed to create fixture issue")
  })

  it("handles empty JSON responses for runGhJson and tryRunGhJson callers", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (
        joined.includes("label create bench-fixture") ||
        joined.includes("label create bench-seed:seedtest")
      ) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success("")
      }

      if (joined.includes("repos/aryeko/ghx-bench-fixtures/issues --method POST")) {
        return success({
          id: 12345,
          number: 42,
          html_url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
        })
      }

      if (joined.includes("issue view 42 --repo aryeko/ghx-bench-fixtures --json id,number,url")) {
        return success({
          id: "I_seed",
          number: 42,
          url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
        })
      }

      if (
        joined.includes("pr list") &&
        joined.includes("--label bench-seed:seedtest") &&
        joined.includes("--json id,number")
      ) {
        return success([{ id: "PR_seed", number: 17 }])
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        return success({
          data: {
            repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
          },
        })
      }

      if (joined.includes("workflow run bench-rerun-failed.yml")) {
        return { status: 1, stdout: "", stderr: "dispatch failed" }
      }

      if (joined.includes("pr checks 17") && joined.includes("--json state,link")) {
        return success([])
      }

      if (joined.includes("run list --repo aryeko/ghx-bench-fixtures --workflow ci.yml")) {
        return success([])
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/releases?per_page=20")) {
        return success("")
      }

      if (joined.includes("project list --owner aryeko --format json")) {
        return success("")
      }

      if (
        joined.includes("project create --owner aryeko --title") &&
        joined.includes("--format json")
      ) {
        return success({ id: "PVT_seed", number: 9 })
      }

      if (
        joined.includes("project item-add 9 --owner aryeko") &&
        joined.includes("--format json")
      ) {
        return success("")
      }

      if (joined.includes("project field-list 9 --owner aryeko --format json")) {
        return success("")
      }

      return success({})
    })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-empty-json-"))
    const outFile = join(root, "fixture.json")

    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
    })

    expect(manifest.resources.project).toMatchObject({
      number: 9,
      id: "PVT_seed",
      item_id: "",
      field_id: "",
      option_id: "",
    })
    expect(manifest.resources.release).toMatchObject({ id: 1, tag_name: "v0.0.0-bench" })
  })

  it("falls back to run list when PR check link has no run id", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (
        joined.includes("label create bench-fixture") ||
        joined.includes("label create bench-seed:seedtest")
      ) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([
          {
            id: "I_seed",
            number: 42,
            url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          },
        ])
      }

      if (
        joined.includes("pr list") &&
        joined.includes("--label bench-seed:seedtest") &&
        joined.includes("--json id,number")
      ) {
        return success([{ id: "PR_seed", number: 17 }])
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        return success({
          data: {
            repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
          },
        })
      }

      if (joined.includes("workflow run bench-rerun-failed.yml")) {
        return { status: 1, stdout: "", stderr: "dispatch failed" }
      }

      if (joined.includes("pr checks 17") && joined.includes("--json state,link")) {
        return success([
          {
            state: "FAILURE",
            link: "https://github.com/aryeko/ghx-bench-fixtures/actions/workflows/ci.yml",
          },
        ])
      }

      if (
        joined.includes(
          "run list --repo aryeko/ghx-bench-fixtures --workflow ci.yml --status failure --limit 1 --json databaseId",
        )
      ) {
        return success({ items: [{ databaseId: "not-a-number" }] })
      }

      if (
        joined.includes(
          "run list --repo aryeko/ghx-bench-fixtures --workflow ci.yml --limit 1 --json databaseId",
        )
      ) {
        return success([{ databaseId: 222 }])
      }

      if (joined.includes("run view 222") && joined.includes("--json jobs")) {
        return success({ jobs: [{}] })
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/releases?per_page=20")) {
        return success([])
      }

      if (joined.includes("project list --owner aryeko --format json")) {
        return success([{ id: "PVT_existing", number: 4, title: "GHX Bench Fixtures" }])
      }

      if (joined.includes("project item-add 4 --owner aryeko")) {
        return success({ id: "PVTI_seed" })
      }

      if (joined.includes("project field-list 4 --owner aryeko --format json")) {
        return success([])
      }

      return success({})
    })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-link-no-run-id-"))
    const outFile = join(root, "fixture.json")

    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
    })

    expect(manifest.resources.workflow_run).toMatchObject({ id: 222 })
    expect(manifest.resources.workflow_job).toMatchObject({ id: 1 })
    expect(manifest.resources.check_run).toMatchObject({ id: 1 })
  })

  it("seeds only issue when requires is ['issue']", async () => {
    const calls: string[] = []
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")
      calls.push(joined)

      if (joined.includes("label create")) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([
          {
            id: "I_seed",
            number: 42,
            url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          },
        ])
      }

      return success({})
    })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-issue-only-"))
    const outFile = join(root, "fixture.json")

    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
      requires: ["issue"],
    })

    expect(manifest.resources.issue).toMatchObject({ id: "I_seed", number: 42 })
    expect(manifest.resources.pr).toMatchObject({ id: "", number: 0 })
    expect(manifest.resources.pr_thread).toMatchObject({ id: "" })
    expect(manifest.resources.workflow_run).toMatchObject({ id: 1 })
    expect(manifest.resources.project).toMatchObject({ number: 1, id: "" })

    const prCreationCalls = calls.filter(
      (c) => c.includes("/pulls --method POST") || c.includes("pr list --repo"),
    )
    expect(prCreationCalls).toHaveLength(0)

    const workflowCalls = calls.filter((c) => c.includes("workflow run") || c.includes("run list"))
    expect(workflowCalls).toHaveLength(0)

    const projectCalls = calls.filter((c) => c.includes("project"))
    expect(projectCalls).toHaveLength(0)
  })

  it("seeds issue + PR + thread when requires is ['pr'], skips workflow and project", async () => {
    const calls: string[] = []
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")
      calls.push(joined)

      if (joined.includes("label create")) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([
          {
            id: "I_seed",
            number: 42,
            url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          },
        ])
      }

      if (
        joined.includes("pr list") &&
        joined.includes("--label bench-seed:seedtest") &&
        joined.includes("--json id,number")
      ) {
        return success([{ id: "PR_seed", number: 17 }])
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        return success({
          data: {
            repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
          },
        })
      }

      return success({})
    })

    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-pr-only-"))
    const outFile = join(root, "fixture.json")

    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
      requires: ["pr"],
    })

    expect(manifest.resources.issue).toMatchObject({ id: "I_seed", number: 42 })
    expect(manifest.resources.pr).toMatchObject({ id: "PR_seed", number: 17 })
    expect(manifest.resources.pr_thread).toMatchObject({ id: "PRRT_seed" })
    expect(manifest.resources.pr_with_reviews).toMatchObject({ id: "", number: 0 })
    expect(manifest.resources.workflow_run).toMatchObject({ id: 1 })
    expect(manifest.resources.project).toMatchObject({ number: 1, id: "" })

    const workflowCalls = calls.filter((c) => c.includes("workflow run") || c.includes("run list"))
    expect(workflowCalls).toHaveLength(0)

    const projectCalls = calls.filter((c) => c.includes("project"))
    expect(projectCalls).toHaveLength(0)
  })

  it("seeds everything when requires is omitted (backwards compat)", async () => {
    spawnSyncMock.mockImplementation((cmd: string, args: string[]) => {
      if (cmd !== "gh") {
        return { status: 1, stdout: "", stderr: "unexpected command" }
      }

      const joined = args.join(" ")

      if (joined.includes("label create")) {
        return success("")
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return success([
          {
            id: "I_seed",
            number: 42,
            url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          },
        ])
      }

      if (
        joined.includes("pr list") &&
        joined.includes("--label bench-seed:seedtest") &&
        joined.includes("--json id,number")
      ) {
        return success([{ id: "PR_seed", number: 17 }])
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        return success({
          data: {
            repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
          },
        })
      }

      if (joined.includes("workflow run bench-rerun-failed.yml")) {
        return { status: 1, stdout: "", stderr: "dispatch failed" }
      }

      if (joined.includes("pr checks 17") && joined.includes("--json state,link")) {
        return success([])
      }

      if (joined.includes("run list --repo aryeko/ghx-bench-fixtures --workflow ci.yml")) {
        return success([])
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/releases?per_page=20")) {
        return success([])
      }

      if (joined.includes("project list --owner aryeko --format json")) {
        return success([{ id: "PVT_existing", number: 4, title: "GHX Bench Fixtures" }])
      }

      if (joined.includes("project item-add 4 --owner aryeko")) {
        return success({ id: "PVTI_seed" })
      }

      if (joined.includes("project field-list 4 --owner aryeko --format json")) {
        return success([])
      }

      return success({})
    })

    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const root = await mkdtemp(join(tmpdir(), "ghx-bench-fixture-seed-no-requires-"))
    const outFile = join(root, "fixture.json")

    // No requires field — should seed everything
    const manifest = await seedFixtureManifest({
      repo: "aryeko/ghx-bench-fixtures",
      outFile,
      seedId: "seedtest",
    })

    // All resources should have real values (not placeholders)
    expect(manifest.resources.issue).toMatchObject({ id: "I_seed", number: 42 })
    expect(manifest.resources.pr).toMatchObject({ id: "PR_seed", number: 17 })
    expect(manifest.resources.pr_thread).toMatchObject({ id: "PRRT_seed" })
    expect(manifest.resources.project).toMatchObject({ number: 4, id: "PVT_existing" })
  })
})
