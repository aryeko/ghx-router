import { beforeEach, describe, expect, it, vi } from "vitest"

const spawnSyncMock = vi.hoisted(() => vi.fn())
const runGhMock = vi.hoisted(() => vi.fn())
const mkdirMock = vi.hoisted(() => vi.fn())
const writeFileMock = vi.hoisted(() => vi.fn())

vi.mock("node:child_process", () => ({
  spawnSync: spawnSyncMock,
}))

vi.mock("@bench/fixture/gh-client.js", () => ({
  runGh: runGhMock,
}))

vi.mock("@bench/fixture/seed-pr-basic.js", () => ({
  findSeededPr: vi.fn().mockReturnValue(null),
  createSeedPr: vi.fn().mockReturnValue({ id: "PR_1", number: 1 }),
  ensurePrThread: vi.fn().mockReturnValue("THREAD_1"),
}))

vi.mock("@bench/fixture/seed-pr-reviews.js", () => ({
  createPrWithReviews: vi.fn().mockReturnValue({ id: "PR_2", number: 2, thread_count: 4 }),
}))

vi.mock("@bench/fixture/seed-pr-bugs.js", () => ({
  createPrWithBugs: vi.fn().mockReturnValue({ id: "PR_B", number: 4 }),
}))

vi.mock("@bench/fixture/seed-pr-mixed-threads.js", () => ({
  createPrWithMixedThreads: vi.fn().mockReturnValue({
    id: "PR_3",
    number: 3,
    resolved_count: 4,
    unresolved_count: 3,
  }),
}))

vi.mock("@bench/fixture/seed-issue.js", () => ({
  findOrCreateIssue: vi.fn().mockReturnValue({ id: "I_1", number: 1, url: "https://..." }),
  createIssueTriage: vi.fn().mockReturnValue({ id: "I_2", number: 2, url: "https://..." }),
}))

vi.mock("@bench/fixture/seed-release.js", () => ({
  findLatestDraftRelease: vi.fn().mockReturnValue(null),
}))

vi.mock("@bench/fixture/seed-project.js", () => ({
  ensureProjectFixture: vi.fn().mockReturnValue({
    number: 1,
    id: "PROJ_1",
    item_id: "ITEM_1",
    field_id: "FIELD_1",
    option_id: "OPT_1",
  }),
}))

vi.mock("@bench/fixture/seed-workflow.js", () => ({
  ensureFailedRerunWorkflowRun: vi.fn().mockResolvedValue(null),
  findLatestWorkflowRun: vi.fn().mockReturnValue(null),
}))

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>()
  return {
    ...actual,
    mkdir: mkdirMock.mockResolvedValue(undefined),
    writeFile: writeFileMock.mockResolvedValue(undefined),
  }
})

import { seedFixtureManifest } from "@bench/fixture/seeder.js"

describe("fixture seed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("requires repo, outFile, and seedId options", async () => {
    await expect(seedFixtureManifest({} as never)).rejects.toThrow()
  })

  it("validates repo format", async () => {
    await expect(
      seedFixtureManifest({
        repo: "invalid",
        outFile: "/tmp/test.json",
        seedId: "test",
      } as never),
    ).rejects.toThrow("invalid repo format")
  })

  it("validates outFile is provided", async () => {
    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "",
        seedId: "test",
      } as never),
    ).rejects.toThrow("outFile must be a non-empty path")
  })

  it("validates seedId is provided", async () => {
    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "",
      } as never),
    ).rejects.toThrow("seedId must be a non-empty string")
  })
})

describe("validateManifest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("throws when pr_with_reviews is required but number is 0", async () => {
    const { createPrWithReviews: createPrWithReviewsMock } = await import(
      "@bench/fixture/seed-pr-reviews.js"
    )

    vi.mocked(createPrWithReviewsMock).mockReturnValue({
      id: "PR_2",
      number: 0,
      thread_count: 0,
    })

    await expect(
      seedFixtureManifest(
        {
          repo: "aryeko/ghx-bench-fixtures",
          outFile: "/tmp/test.json",
          seedId: "test",
          requires: ["pr_with_reviews"],
        },
        "reviewer-token",
      ),
    ).rejects.toThrow("pr_with_reviews fixture missing")
  })

  it("throws when pr_with_mixed_threads is required but number is 0", async () => {
    const { createPrWithMixedThreads: createPrWithMixedThreadsMock } = await import(
      "@bench/fixture/seed-pr-mixed-threads.js"
    )

    vi.mocked(createPrWithMixedThreadsMock).mockReturnValue({
      id: "PR_3",
      number: 0,
      resolved_count: 0,
      unresolved_count: 0,
    })

    await expect(
      seedFixtureManifest(
        {
          repo: "aryeko/ghx-bench-fixtures",
          outFile: "/tmp/test.json",
          seedId: "test",
          requires: ["pr_with_mixed_threads"],
        },
        "reviewer-token",
      ),
    ).rejects.toThrow("pr_with_mixed_threads fixture missing")
  })

  it("does not throw when required fixtures have valid numbers", async () => {
    const { createPrWithReviews: createPrWithReviewsMock } = await import(
      "@bench/fixture/seed-pr-reviews.js"
    )

    vi.mocked(createPrWithReviewsMock).mockReturnValue({
      id: "PR_2",
      number: 5,
      thread_count: 4,
    })

    await expect(
      seedFixtureManifest(
        {
          repo: "aryeko/ghx-bench-fixtures",
          outFile: "/tmp/test.json",
          seedId: "test",
          requires: ["pr_with_reviews"],
        },
        "reviewer-token",
      ),
    ).resolves.toBeDefined()
  })

  it("does not throw for workflow_run when not a placeholder", async () => {
    const { ensureFailedRerunWorkflowRun: ensureFailedRerunWorkflowRunMock } = await import(
      "@bench/fixture/seed-workflow.js"
    )

    vi.mocked(ensureFailedRerunWorkflowRunMock).mockResolvedValue({
      id: 999,
      job_id: 100,
      check_run_id: 200,
    })

    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "test",
        requires: ["workflow_run"],
      }),
    ).resolves.toBeDefined()
  })

  it("throws when workflow_run is a placeholder (id === 1)", async () => {
    const { ensureFailedRerunWorkflowRun: ensureFailedRerunWorkflowRunMock } = await import(
      "@bench/fixture/seed-workflow.js"
    )

    vi.mocked(ensureFailedRerunWorkflowRunMock).mockResolvedValue(null)

    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "test",
        requires: ["workflow_run"],
      }),
    ).rejects.toThrow("workflow_run fixture is a placeholder")
  })
})

describe("pr_with_mixed_threads seeding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("seeds pr_with_mixed_threads when reviewerToken is provided", async () => {
    const { createPrWithMixedThreads: createPrWithMixedThreadsMock } = await import(
      "@bench/fixture/seed-pr-mixed-threads.js"
    )

    vi.mocked(createPrWithMixedThreadsMock).mockReturnValue({
      id: "PR_3",
      number: 99,
      resolved_count: 4,
      unresolved_count: 3,
    })

    const result = await seedFixtureManifest(
      {
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "test",
        requires: ["pr_with_mixed_threads"],
      },
      "reviewer-token",
    )

    expect(vi.mocked(createPrWithMixedThreadsMock)).toHaveBeenCalled()
    expect((result.resources["pr_with_mixed_threads"] as { number: number }).number).toBe(99)
  })

  it("throws when no reviewerToken for pr_with_mixed_threads", async () => {
    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "test",
        requires: ["pr_with_mixed_threads"],
      }),
    ).rejects.toThrow("pr_with_mixed_threads requires a reviewer token")
  })

  it("seeds pr_with_reviews when reviewerToken is provided", async () => {
    const { createPrWithReviews: createPrWithReviewsMock } = await import(
      "@bench/fixture/seed-pr-reviews.js"
    )

    vi.mocked(createPrWithReviewsMock).mockReturnValue({
      id: "PR_2",
      number: 50,
      thread_count: 4,
    })

    const result = await seedFixtureManifest(
      {
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "test",
        requires: ["pr_with_reviews"],
      },
      "reviewer-token",
    )

    expect(vi.mocked(createPrWithReviewsMock)).toHaveBeenCalled()
    expect((result.resources["pr_with_reviews"] as { number: number }).number).toBe(50)
  })

  it("throws when no reviewerToken for pr_with_reviews", async () => {
    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "test",
        requires: ["pr_with_reviews"],
      }),
    ).rejects.toThrow("pr_with_reviews requires a reviewer token")
  })

  it("seeds pr_with_bugs when reviewerToken is provided", async () => {
    const { createPrWithBugs: createPrWithBugsMock } = await import(
      "@bench/fixture/seed-pr-bugs.js"
    )

    vi.mocked(createPrWithBugsMock).mockReturnValue({ id: "PR_B", number: 42 })

    const result = await seedFixtureManifest(
      {
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "test",
        requires: ["pr_with_bugs"],
      },
      "reviewer-token",
    )

    expect(vi.mocked(createPrWithBugsMock)).toHaveBeenCalledWith(
      "aryeko/ghx-bench-fixtures",
      "test",
      expect.any(String),
      "reviewer-token",
    )
    expect((result.resources["pr_with_bugs"] as { number: number }).number).toBe(42)
  })

  it("throws when no reviewerToken for pr_with_bugs", async () => {
    await expect(
      seedFixtureManifest({
        repo: "aryeko/ghx-bench-fixtures",
        outFile: "/tmp/test.json",
        seedId: "test",
        requires: ["pr_with_bugs"],
      }),
    ).rejects.toThrow("pr_with_bugs requires a reviewer token")
  })
})
