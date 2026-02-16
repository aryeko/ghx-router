import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}))

import { seedFixtureManifest } from "../../src/fixture/seed.js"

describe("fixture seed", () => {
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
        return { status: 0, stdout: "", stderr: "" }
      }

      if (joined.includes("issue list") && joined.includes("bench-seed:seedtest")) {
        return { status: 0, stdout: "[]", stderr: "" }
      }

      if (joined.includes("repos/aryeko/ghx-bench-fixtures/issues --method POST")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            id: 12345,
            number: 42,
            html_url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          }),
          stderr: "",
        }
      }

      if (joined.includes("issue view 42 --repo aryeko/ghx-bench-fixtures --json id,number,url")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            id: "I_seed",
            number: 42,
            url: "https://github.com/aryeko/ghx-bench-fixtures/issues/42",
          }),
          stderr: "",
        }
      }

      if (joined.includes("pr list") && joined.includes("--state open")) {
        return { status: 0, stdout: "[]", stderr: "" }
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/git/ref/heads/main")) {
        return {
          status: 0,
          stdout: JSON.stringify({ object: { sha: "base123" } }),
          stderr: "",
        }
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/git/refs --method POST")) {
        return { status: 0, stdout: "{}", stderr: "" }
      }

      if (
        joined.includes(
          "api repos/aryeko/ghx-bench-fixtures/contents/.bench/seed-seedtest.md --method PUT",
        )
      ) {
        return { status: 0, stdout: "{}", stderr: "" }
      }

      if (joined.includes("repos/aryeko/ghx-bench-fixtures/pulls --method POST")) {
        return {
          status: 0,
          stdout: JSON.stringify({ node_id: "PR_seed", number: 17, head: { sha: "abc123" } }),
          stderr: "",
        }
      }

      if (joined.includes("api graphql") && joined.includes("reviewThreads")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            data: {
              repository: { pullRequest: { reviewThreads: { nodes: [{ id: "PRRT_seed" }] } } },
            },
          }),
          stderr: "",
        }
      }

      if (joined.includes("run list") || joined.includes("run view")) {
        if (joined.includes("run list") && joined.includes("databaseId,displayTitle,createdAt")) {
          return {
            status: 0,
            stdout: JSON.stringify([
              {
                databaseId: 555,
                displayTitle: "bench-rerun-failed seedtest",
                createdAt: new Date().toISOString(),
              },
            ]),
            stderr: "",
          }
        }

        if (joined.includes("run view 555") && joined.includes("--json status,conclusion")) {
          return {
            status: 0,
            stdout: JSON.stringify({ status: "completed", conclusion: "failure" }),
            stderr: "",
          }
        }

        if (joined.includes("run view 555") && joined.includes("--json jobs")) {
          return {
            status: 0,
            stdout: JSON.stringify({ jobs: [{ databaseId: 777, conclusion: "failure" }] }),
            stderr: "",
          }
        }

        return { status: 0, stdout: "[]", stderr: "" }
      }

      if (joined.includes("api repos/aryeko/ghx-bench-fixtures/releases?per_page=20")) {
        return { status: 0, stdout: "[]", stderr: "" }
      }

      if (joined.includes("project list --owner aryeko --format json")) {
        return {
          status: 0,
          stdout: JSON.stringify([{ id: "PVT_existing", number: 4, title: "planpilot roadmap" }]),
          stderr: "",
        }
      }

      if (
        joined.includes("project create --owner aryeko --title") &&
        joined.includes("--format json")
      ) {
        return {
          status: 0,
          stdout: JSON.stringify({ id: "PVT_seed", number: 9 }),
          stderr: "",
        }
      }

      if (
        joined.includes("project item-add 9 --owner aryeko") &&
        joined.includes("/issues/42") &&
        joined.includes("--format json")
      ) {
        return {
          status: 0,
          stdout: JSON.stringify({ id: "PVTI_seed" }),
          stderr: "",
        }
      }

      if (joined.includes("project field-list 9 --owner aryeko --format json")) {
        return {
          status: 0,
          stdout: JSON.stringify({
            fields: [
              {
                id: "PVTSSF_seed",
                name: "Status",
                type: "ProjectV2SingleSelectField",
                options: [{ id: "todo_option", name: "Todo" }],
              },
            ],
          }),
          stderr: "",
        }
      }

      return { status: 0, stdout: "{}", stderr: "" }
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
})
