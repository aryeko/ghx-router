# Eval Missing Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement three features required by the eval design spec: `eval fixture seed` (full + dry-run + `--seed-id`), `eval analyze`, and `eval report`.

**Architecture:** Each feature is a thin CLI layer wiring existing infrastructure. `seed` delegates to fixture seeders per resource type. `analyze` loads session traces and runs agent-profiler's 5 built-in analyzers. `report` calls agent-profiler's `generateReport()` with loaded JSONL rows and optional analysis bundles.

**Tech Stack:** TypeScript (strict, ESM, NodeNext), Zod validation, Vitest tests, `gh` CLI for GitHub operations, agent-profiler contracts (`Analyzer`, `generateReport`, `readJsonlFile`).

**Design doc:** `docs/plans/2026-02-28-eval-missing-features-design.md`

---

### Task 1: Fixture Seeder Interface and Registry

**Files:**
- Create: `packages/eval/src/fixture/seeders/types.ts`
- Create: `packages/eval/src/fixture/seeders/index.ts`
- Test: `packages/eval/test/unit/fixture/seeders/registry.test.ts`

**Context:** The seeder interface defines how each fixture type creates its GitHub resource. The registry maps fixture type prefixes to seeder implementations. Scenarios have fixture `requires` entries like `"pr_with_mixed_threads"` and `"pr_with_changes"` -- the prefix before the first `_` determines the resource type (`pr` or `issue`).

**Step 1: Write the failing test**

```typescript
// packages/eval/test/unit/fixture/seeders/registry.test.ts
import { describe, expect, it } from "vitest"
import { getSeeder, registerSeeder } from "@eval/fixture/seeders/index.js"
import type { FixtureSeeder } from "@eval/fixture/seeders/types.js"

describe("seeder registry", () => {
  it("returns registered seeder for known type", () => {
    const mockSeeder: FixtureSeeder = {
      type: "test",
      seed: async () => ({
        type: "test",
        number: 1,
        repo: "owner/repo",
        metadata: {},
      }),
    }
    registerSeeder(mockSeeder)
    expect(getSeeder("test")).toBe(mockSeeder)
  })

  it("throws for unregistered type", () => {
    expect(() => getSeeder("unknown_type")).toThrow("No seeder registered for type")
  })

  it("resolves type from fixture name prefix", () => {
    const mockSeeder: FixtureSeeder = {
      type: "pr",
      seed: async () => ({
        type: "pr",
        number: 1,
        repo: "owner/repo",
        metadata: {},
      }),
    }
    registerSeeder(mockSeeder)
    expect(getSeeder("pr")).toBe(mockSeeder)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/registry.test.ts`
Expected: FAIL (modules don't exist)

**Step 3: Write the types and registry**

```typescript
// packages/eval/src/fixture/seeders/types.ts
import type { FixtureResource } from "@eval/fixture/manifest.js"

/** Options passed to a seeder when creating a fixture resource. */
export interface SeedOptions {
  /** Target repo in "owner/repo" format. */
  readonly repo: string
  /** Fixture name (key in the manifest), e.g. "pr_with_mixed_threads". */
  readonly name: string
  /** Labels to apply to the created resource. */
  readonly labels: readonly string[]
}

/** Creates a specific type of GitHub fixture resource. */
export interface FixtureSeeder {
  /** Resource type this seeder handles, e.g. "pr" or "issue". */
  readonly type: string
  /** Create a fixture resource and return its manifest entry. */
  seed(options: SeedOptions): Promise<FixtureResource>
}
```

```typescript
// packages/eval/src/fixture/seeders/index.ts
import type { FixtureSeeder } from "./types.js"

const registry = new Map<string, FixtureSeeder>()

export function registerSeeder(seeder: FixtureSeeder): void {
  registry.set(seeder.type, seeder)
}

export function getSeeder(type: string): FixtureSeeder {
  const seeder = registry.get(type)
  if (!seeder) {
    throw new Error(`No seeder registered for type "${type}"`)
  }
  return seeder
}

export type { FixtureSeeder, SeedOptions } from "./types.js"
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/registry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/eval/src/fixture/seeders/ packages/eval/test/unit/fixture/seeders/
git commit -m "feat(eval): add fixture seeder interface and registry"
```

---

### Task 2: PR Seeder Implementation

**Files:**
- Create: `packages/eval/src/fixture/seeders/pr-seeder.ts`
- Test: `packages/eval/test/unit/fixture/seeders/pr-seeder.test.ts`

**Context:** The PR seeder creates a branch, commits a placeholder file, and opens a PR. It uses `gh` CLI commands. The seeder records `originalSha` in metadata for reset support. The `runGh` helper should be extracted so tests can mock it.

**Step 1: Write the failing test**

```typescript
// packages/eval/test/unit/fixture/seeders/pr-seeder.test.ts
import { afterEach, describe, expect, it, vi } from "vitest"

// Mock child_process before importing
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

import { execFile } from "node:child_process"
import { createPrSeeder } from "@eval/fixture/seeders/pr-seeder.js"

const mockExecFile = vi.mocked(execFile)

afterEach(() => {
  vi.clearAllMocks()
})

describe("PrSeeder", () => {
  it("creates a branch, commits, and opens a PR", async () => {
    // Mock gh api for default branch
    mockExecFile.mockImplementation((_cmd, args, cb) => {
      const argsStr = (args as string[]).join(" ")
      if (argsStr.includes("defaultBranchRef")) {
        ;(cb as Function)(null, { stdout: JSON.stringify({ data: { repository: { defaultBranchRef: { name: "main" } } } }) })
      } else if (argsStr.includes("git/refs")) {
        ;(cb as Function)(null, { stdout: JSON.stringify({ object: { sha: "abc123" } }) })
      } else if (argsStr.includes("git/trees")) {
        ;(cb as Function)(null, { stdout: JSON.stringify({ sha: "tree123" }) })
      } else if (argsStr.includes("git/commits")) {
        ;(cb as Function)(null, { stdout: JSON.stringify({ sha: "commit123" }) })
      } else if (argsStr.includes("POST") && argsStr.includes("refs")) {
        ;(cb as Function)(null, { stdout: "" })
      } else if (argsStr.includes("pr create")) {
        ;(cb as Function)(null, { stdout: "https://github.com/owner/repo/pull/42" })
      } else if (argsStr.includes("pr view")) {
        ;(cb as Function)(null, { stdout: JSON.stringify({ number: 42, headRefOid: "commit123" }) })
      } else {
        ;(cb as Function)(null, { stdout: "" })
      }
      return {} as any
    })

    const seeder = createPrSeeder()
    const result = await seeder.seed({
      repo: "owner/repo",
      name: "pr_with_changes",
      labels: ["bench-fixture"],
    })

    expect(result.type).toBe("pr")
    expect(result.number).toBe(42)
    expect(result.repo).toBe("owner/repo")
    expect(result.branch).toContain("bench-fixture")
    expect(result.metadata["originalSha"]).toBeDefined()
  })

  it("sets type to pr", () => {
    const seeder = createPrSeeder()
    expect(seeder.type).toBe("pr")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/pr-seeder.test.ts`
Expected: FAIL (module doesn't exist)

**Step 3: Write the PR seeder**

```typescript
// packages/eval/src/fixture/seeders/pr-seeder.ts
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { FixtureResource } from "@eval/fixture/manifest.js"
import type { FixtureSeeder, SeedOptions } from "./types.js"

const execFileAsync = promisify(execFile)

async function runGh(args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("gh", args as string[])
  return stdout.trim()
}

/**
 * Creates a FixtureSeeder that opens a PR with a placeholder commit.
 *
 * Flow:
 * 1. Get default branch name via GraphQL
 * 2. Get HEAD sha of default branch
 * 3. Create a tree with a placeholder file
 * 4. Create a commit on that tree
 * 5. Create a ref (branch) pointing to the commit
 * 6. Open a PR from the new branch to the default branch
 * 7. Return the FixtureResource with originalSha in metadata
 */
export function createPrSeeder(): FixtureSeeder {
  return {
    type: "pr",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const { repo, name, labels } = options
      const branchName = `bench-fixture/${name}-${Date.now()}`

      // 1. Get default branch
      const defaultBranchData = await runGh([
        "api",
        "graphql",
        "-f",
        `query=query { repository(owner: "${repo.split("/")[0]}", name: "${repo.split("/")[1]}") { defaultBranchRef { name } } }`,
      ])
      const defaultBranch = (JSON.parse(defaultBranchData) as {
        data: { repository: { defaultBranchRef: { name: string } } }
      }).data.repository.defaultBranchRef.name

      // 2. Get HEAD sha of default branch
      const refData = await runGh([
        "api",
        `repos/${repo}/git/refs/heads/${defaultBranch}`,
      ])
      const baseSha = (JSON.parse(refData) as { object: { sha: string } }).object.sha

      // 3. Create tree with placeholder file
      const treeData = await runGh([
        "api",
        `repos/${repo}/git/trees`,
        "--method",
        "POST",
        "--field",
        `base_tree=${baseSha}`,
        "--field",
        `tree[][path]=bench-fixtures/${name}.md`,
        "--field",
        "tree[][mode]=100644",
        "--field",
        "tree[][type]=blob",
        "--field",
        `tree[][content]=Benchmark fixture: ${name}`,
      ])
      const treeSha = (JSON.parse(treeData) as { sha: string }).sha

      // 4. Create commit
      const commitData = await runGh([
        "api",
        `repos/${repo}/git/commits`,
        "--method",
        "POST",
        "--field",
        `message=bench: seed fixture ${name}`,
        "--field",
        `tree=${treeSha}`,
        "--field",
        `parents[]=${baseSha}`,
      ])
      const commitSha = (JSON.parse(commitData) as { sha: string }).sha

      // 5. Create branch ref
      await runGh([
        "api",
        `repos/${repo}/git/refs`,
        "--method",
        "POST",
        "--field",
        `ref=refs/heads/${branchName}`,
        "--field",
        `sha=${commitSha}`,
      ])

      // 6. Open PR
      const labelArgs = labels.flatMap((l) => ["--label", l])
      await runGh([
        "pr",
        "create",
        "--repo",
        repo,
        "--head",
        branchName,
        "--base",
        defaultBranch,
        "--title",
        `[bench-fixture] ${name}`,
        "--body",
        `Benchmark fixture for eval scenario. Fixture: ${name}`,
        ...labelArgs,
      ])

      // 7. Get PR number
      const prViewData = await runGh([
        "pr",
        "view",
        branchName,
        "--repo",
        repo,
        "--json",
        "number,headRefOid",
      ])
      const prInfo = JSON.parse(prViewData) as { number: number; headRefOid: string }

      return {
        type: "pr",
        number: prInfo.number,
        repo,
        branch: branchName,
        labels: [...labels],
        metadata: {
          originalSha: prInfo.headRefOid,
          baseBranch: defaultBranch,
        },
      }
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/pr-seeder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/eval/src/fixture/seeders/pr-seeder.ts packages/eval/test/unit/fixture/seeders/pr-seeder.test.ts
git commit -m "feat(eval): add PR fixture seeder"
```

---

### Task 3: Issue Seeder Implementation

**Files:**
- Create: `packages/eval/src/fixture/seeders/issue-seeder.ts`
- Test: `packages/eval/test/unit/fixture/seeders/issue-seeder.test.ts`

**Context:** Simpler than PR seeder. Creates a GitHub issue with labels via `gh issue create`.

**Step 1: Write the failing test**

```typescript
// packages/eval/test/unit/fixture/seeders/issue-seeder.test.ts
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}))

import { execFile } from "node:child_process"
import { createIssueSeeder } from "@eval/fixture/seeders/issue-seeder.js"

const mockExecFile = vi.mocked(execFile)

afterEach(() => {
  vi.clearAllMocks()
})

describe("IssueSeeder", () => {
  it("creates an issue and returns resource", async () => {
    mockExecFile.mockImplementation((_cmd, args, cb) => {
      const argsStr = (args as string[]).join(" ")
      if (argsStr.includes("issue create")) {
        ;(cb as Function)(null, { stdout: "https://github.com/owner/repo/issues/15" })
      } else if (argsStr.includes("issue view")) {
        ;(cb as Function)(null, { stdout: JSON.stringify({ number: 15 }) })
      } else {
        ;(cb as Function)(null, { stdout: "" })
      }
      return {} as any
    })

    const seeder = createIssueSeeder()
    const result = await seeder.seed({
      repo: "owner/repo",
      name: "issue_for_triage",
      labels: ["bench-fixture", "bug"],
    })

    expect(result.type).toBe("issue")
    expect(result.number).toBe(15)
    expect(result.repo).toBe("owner/repo")
    expect(result.labels).toEqual(["bench-fixture", "bug"])
  })

  it("sets type to issue", () => {
    const seeder = createIssueSeeder()
    expect(seeder.type).toBe("issue")
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/issue-seeder.test.ts`
Expected: FAIL

**Step 3: Write the issue seeder**

```typescript
// packages/eval/src/fixture/seeders/issue-seeder.ts
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { FixtureResource } from "@eval/fixture/manifest.js"
import type { FixtureSeeder, SeedOptions } from "./types.js"

const execFileAsync = promisify(execFile)

async function runGh(args: readonly string[]): Promise<string> {
  const { stdout } = await execFileAsync("gh", args as string[])
  return stdout.trim()
}

/**
 * Creates a FixtureSeeder that opens a GitHub issue.
 */
export function createIssueSeeder(): FixtureSeeder {
  return {
    type: "issue",

    async seed(options: SeedOptions): Promise<FixtureResource> {
      const { repo, name, labels } = options
      const labelArgs = labels.flatMap((l) => ["--label", l])

      await runGh([
        "issue",
        "create",
        "--repo",
        repo,
        "--title",
        `[bench-fixture] ${name}`,
        "--body",
        `Benchmark fixture for eval scenario. Fixture: ${name}`,
        ...labelArgs,
      ])

      // Get issue number from the newly created issue
      const issueData = await runGh([
        "issue",
        "list",
        "--repo",
        repo,
        "--label",
        "bench-fixture",
        "--json",
        "number,title",
        "--limit",
        "1",
        "--search",
        `[bench-fixture] ${name}`,
      ])
      const issues = JSON.parse(issueData) as Array<{ number: number; title: string }>
      const issue = issues[0]
      if (!issue) {
        throw new Error(`Failed to find newly created issue for fixture "${name}"`)
      }

      return {
        type: "issue",
        number: issue.number,
        repo,
        labels: [...labels],
        metadata: {},
      }
    },
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/seeders/issue-seeder.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/eval/src/fixture/seeders/issue-seeder.ts packages/eval/test/unit/fixture/seeders/issue-seeder.test.ts
git commit -m "feat(eval): add issue fixture seeder"
```

---

### Task 4: Implement FixtureManager.seed()

**Files:**
- Modify: `packages/eval/src/fixture/manager.ts:7-14,41-42,79-81`
- Modify: `packages/eval/test/unit/fixture/manager.test.ts:213-229`

**Context:** Replace the `seed()` stub with a real implementation. Add `seedId` to `FixtureManagerOptions`. The method collects unique `fixture.requires` from scenarios, resolves fixture types from the name prefix (text before first `_`), delegates to the appropriate seeder, builds a `FixtureManifest`, and writes it.

**Step 1: Write the failing tests**

Add these tests to `packages/eval/test/unit/fixture/manager.test.ts`, replacing the existing `seed()` tests:

```typescript
// Replace the existing "FixtureManager.seed()" describe block with:

// At the top, add these mocks and imports:
// vi.mock("@eval/fixture/seeders/index.js", () => ({
//   getSeeder: vi.fn(),
//   registerSeeder: vi.fn(),
// }))
// import { getSeeder } from "@eval/fixture/seeders/index.js"

describe("FixtureManager.seed()", () => {
  it("collects unique fixture.requires and seeds each", async () => {
    const mockSeeder = {
      type: "pr",
      seed: vi.fn().mockResolvedValue({
        type: "pr",
        number: 42,
        repo: "owner/repo",
        branch: "bench-fixture/pr_with_changes-123",
        labels: ["bench-fixture"],
        metadata: { originalSha: "abc123" },
      }),
    }
    vi.mocked(getSeeder).mockReturnValue(mockSeeder)

    const manager = new FixtureManager({
      repo: "owner/repo",
      manifest: "fixtures/latest.json",
      seedId: "test-seed",
    })

    const scenarios = [
      {
        id: "sc-001",
        fixture: { requires: ["pr_with_changes"], repo: "owner/repo", bindings: {}, reseedPerIteration: false },
      },
      {
        id: "sc-002",
        fixture: { requires: ["pr_with_changes"], repo: "owner/repo", bindings: {}, reseedPerIteration: false },
      },
    ] as any

    await manager.seed(scenarios)

    // pr_with_changes appears twice but should only be seeded once
    expect(mockSeeder.seed).toHaveBeenCalledTimes(1)
    expect(writeFixtureManifest).toHaveBeenCalledWith(
      "fixtures/latest.json",
      expect.objectContaining({
        seedId: "test-seed",
        repo: "owner/repo",
      }),
    )
  })

  it("uses default seedId when not provided", async () => {
    const mockSeeder = {
      type: "pr",
      seed: vi.fn().mockResolvedValue({
        type: "pr", number: 1, repo: "owner/repo", metadata: {},
      }),
    }
    vi.mocked(getSeeder).mockReturnValue(mockSeeder)

    const manager = new FixtureManager({
      repo: "owner/repo",
      manifest: "fixtures/latest.json",
    })

    await manager.seed([{
      id: "sc-001",
      fixture: { requires: ["pr_test"], repo: "owner/repo", bindings: {}, reseedPerIteration: false },
    }] as any)

    expect(writeFixtureManifest).toHaveBeenCalledWith(
      "fixtures/latest.json",
      expect.objectContaining({ seedId: "default" }),
    )
  })

  it("skips scenarios without fixture requirements", async () => {
    const manager = new FixtureManager({
      repo: "owner/repo",
      manifest: "fixtures/latest.json",
    })

    await manager.seed([{ id: "sc-001" }] as any)

    expect(writeFixtureManifest).toHaveBeenCalledWith(
      "fixtures/latest.json",
      expect.objectContaining({ fixtures: {} }),
    )
  })

  it("resolves seeder type from fixture name prefix", async () => {
    const mockPrSeeder = {
      type: "pr",
      seed: vi.fn().mockResolvedValue({ type: "pr", number: 1, repo: "r", metadata: {} }),
    }
    const mockIssueSeeder = {
      type: "issue",
      seed: vi.fn().mockResolvedValue({ type: "issue", number: 2, repo: "r", metadata: {} }),
    }
    vi.mocked(getSeeder).mockImplementation((type) => {
      if (type === "pr") return mockPrSeeder
      if (type === "issue") return mockIssueSeeder
      throw new Error(`Unknown: ${type}`)
    })

    const manager = new FixtureManager({ repo: "r", manifest: "m.json" })
    await manager.seed([{
      id: "sc-001",
      fixture: {
        requires: ["pr_with_changes", "issue_for_triage"],
        repo: "r",
        bindings: {},
        reseedPerIteration: false,
      },
    }] as any)

    expect(getSeeder).toHaveBeenCalledWith("pr")
    expect(getSeeder).toHaveBeenCalledWith("issue")
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/manager.test.ts`
Expected: FAIL (seed still throws)

**Step 3: Implement seed()**

Modify `packages/eval/src/fixture/manager.ts`:

1. Add `seedId?: string` to `FixtureManagerOptions` (line 13)
2. Replace `seed()` stub (lines 79-81) with the real implementation
3. Import `getSeeder` from `@eval/fixture/seeders/index.js`
4. Import `writeFixtureManifest` from `./manifest.js`
5. Add `resolveFixtureType()` helper that extracts the prefix before the first `_`

The `seed()` method:
```typescript
async seed(scenarios: readonly { readonly fixture?: { readonly requires: readonly string[] } }[]): Promise<void> {
  const uniqueRequires = new Set<string>()
  for (const s of scenarios) {
    if (s.fixture) {
      for (const r of s.fixture.requires) {
        uniqueRequires.add(r)
      }
    }
  }

  const fixtures: Record<string, FixtureResource> = {}

  for (const name of uniqueRequires) {
    const type = resolveFixtureType(name)
    const seeder = getSeeder(type)
    const resource = await seeder.seed({
      repo: this.options.repo,
      name,
      labels: ["bench-fixture"],
    })
    fixtures[name] = resource
  }

  const manifest: FixtureManifest = {
    seedId: this.options.seedId ?? "default",
    createdAt: new Date().toISOString(),
    repo: this.options.repo,
    fixtures,
  }

  await writeFixtureManifest(this.options.manifest, manifest)
}
```

Add helper:
```typescript
function resolveFixtureType(name: string): string {
  const idx = name.indexOf("_")
  return idx === -1 ? name : name.slice(0, idx)
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/manager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/eval/src/fixture/manager.ts packages/eval/test/unit/fixture/manager.test.ts
git commit -m "feat(eval): implement FixtureManager.seed() with seeder delegation"
```

---

### Task 5: Wire --seed-id, --dry-run, and --config into fixture CLI

**Files:**
- Modify: `packages/eval/src/cli/fixture.ts:1-48`
- Modify: `packages/eval/test/unit/cli/fixture.test.ts`

**Context:** Parse `--seed-id` (default `"default"`) and `--dry-run` flags. Pass `seedId` to `FixtureManager` constructor. For `seed`, load config to find scenarios directory, load scenarios, and pass them to `manager.seed()`. Dry-run prints the collected requirements without creating resources.

**Step 1: Write the failing tests**

Add to `packages/eval/test/unit/cli/fixture.test.ts`:

```typescript
describe("seed subcommand", () => {
  // Keep existing tests, add:

  it("passes --seed-id to FixtureManager constructor", async () => {
    const { FixtureManager } = await import("@eval/fixture/manager.js")
    await fixtureFn(["seed", "--seed-id", "my-seed"])
    expect(FixtureManager).toHaveBeenCalledWith(
      expect.objectContaining({ seedId: "my-seed" }),
    )
  })

  it("uses default seedId when --seed-id not provided", async () => {
    const { FixtureManager } = await import("@eval/fixture/manager.js")
    await fixtureFn(["seed"])
    expect(FixtureManager).toHaveBeenCalledWith(
      expect.objectContaining({ seedId: "default" }),
    )
  })

  it("prints dry-run output without calling seed", async () => {
    const { FixtureManager } = await import("@eval/fixture/manager.js")
    await fixtureFn(["seed", "--dry-run"])
    const lastInstance = vi.mocked(FixtureManager).mock.results.at(-1)?.value as {
      seed: ReturnType<typeof vi.fn>
    }
    expect(lastInstance.seed).not.toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("dry-run"))
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/cli/fixture.test.ts`
Expected: FAIL

**Step 3: Update fixture.ts**

Modify `packages/eval/src/cli/fixture.ts`:

- Import `hasFlag` from `./parse-flags.js`
- Import scenario/config loaders
- Parse `--seed-id` and `--dry-run`
- Pass `seedId` to `FixtureManager` constructor
- In `seed` subcommand: load config, load scenarios, pass to `manager.seed()`
- In dry-run: print fixture requirements summary and exit

```typescript
import { join } from "node:path"
import { readFile } from "node:fs/promises"
import { FixtureManager } from "@eval/fixture/manager.js"
import { loadEvalConfig } from "@eval/config/loader.js"
import { loadEvalScenarios } from "@eval/scenario/loader.js"
import { hasFlag, parseFlag } from "./parse-flags.js"

export async function fixture(argv: readonly string[]): Promise<void> {
  const subcommand = argv[0]

  if (!subcommand || !["seed", "status", "cleanup"].includes(subcommand)) {
    console.error(
      "Usage: eval fixture <seed|status|cleanup> [--repo <owner/name>] [--manifest <path>] [--seed-id <id>] [--dry-run] [--all]",
    )
    process.exit(1)
  }

  const repo = parseFlag(argv, "--repo") ?? process.env["EVAL_FIXTURE_REPO"] ?? ""
  const manifest = parseFlag(argv, "--manifest") ?? process.env["EVAL_FIXTURE_MANIFEST"] ?? "fixtures/latest.json"
  const seedId = parseFlag(argv, "--seed-id") ?? "default"
  const dryRun = hasFlag(argv, "--dry-run")

  const manager = new FixtureManager({ repo, manifest, seedId })

  if (subcommand === "seed") {
    const configPath = parseFlag(argv, "--config") ?? "eval.config.yaml"
    const yamlContent = await readFile(configPath, "utf-8")
    const config = loadEvalConfig(yamlContent)
    const scenariosDir = join(process.cwd(), "scenarios")
    const scenarios = await loadEvalScenarios(scenariosDir)

    if (dryRun) {
      const requires = new Set<string>()
      for (const s of scenarios) {
        if (s.fixture) {
          for (const r of s.fixture.requires) {
            requires.add(r)
          }
        }
      }
      console.log("eval fixture seed --dry-run:")
      console.log(`  repo: ${repo}`)
      console.log(`  seed-id: ${seedId}`)
      console.log(`  fixtures to create: ${[...requires].join(", ") || "(none)"}`)
      console.log(`  scenarios: ${scenarios.length}`)
      return
    }

    await manager.seed(scenarios)
    console.log("Fixture seeding complete.")
    return
  }

  // status and cleanup remain unchanged
  if (subcommand === "status") {
    const status = await manager.status()
    console.log("Fixture status:")
    if (status.ok.length > 0) {
      console.log(`  ok: ${status.ok.join(", ")}`)
    }
    if (status.missing.length > 0) {
      console.log(`  missing: ${status.missing.join(", ")}`)
    }
    if (status.ok.length === 0 && status.missing.length === 0) {
      console.log("  no fixtures found")
    }
    return
  }

  if (subcommand === "cleanup") {
    const all = argv.includes("--all")
    await manager.cleanup({ all })
    console.log("Fixture cleanup complete.")
    return
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/cli/fixture.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/eval/src/cli/fixture.ts packages/eval/test/unit/cli/fixture.test.ts
git commit -m "feat(eval): wire --seed-id, --dry-run, and --config to fixture CLI"
```

---

### Task 6: Register Built-in Seeders

**Files:**
- Modify: `packages/eval/src/fixture/seeders/index.ts`
- Modify: `packages/eval/src/fixture/manager.ts` (import to trigger registration)

**Context:** Import and auto-register pr-seeder and issue-seeder when the seeders module loads.

**Step 1: Update index.ts to register built-in seeders on import**

Add to `packages/eval/src/fixture/seeders/index.ts`:

```typescript
import { createPrSeeder } from "./pr-seeder.js"
import { createIssueSeeder } from "./issue-seeder.js"

// Auto-register built-in seeders
registerSeeder(createPrSeeder())
registerSeeder(createIssueSeeder())
```

**Step 2: Import seeders module in manager.ts**

Add to `packages/eval/src/fixture/manager.ts` (top-level import):
```typescript
import "@eval/fixture/seeders/index.js"
```

**Step 3: Run all fixture tests**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/fixture/`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/eval/src/fixture/seeders/index.ts packages/eval/src/fixture/manager.ts
git commit -m "feat(eval): register built-in PR and issue seeders"
```

---

### Task 7: Implement eval analyze

**Files:**
- Modify: `packages/eval/src/cli/analyze.ts:1-7`
- Create: `packages/eval/src/analysis/run-analyzers.ts`
- Create: `packages/eval/test/unit/analysis/run-analyzers.test.ts`
- Modify: `packages/eval/test/unit/cli/analyze.test.ts`

**Context:** The analyze command loads session traces exported by `eval run`, runs the 5 built-in profiler analyzers on each, and writes `SessionAnalysisBundle` records. Traces are at `{run-dir}/sessions/{scenarioId}/{mode}-iter-{n}.json`.

**Step 1: Write the failing test for run-analyzers**

```typescript
// packages/eval/test/unit/analysis/run-analyzers.test.ts
import { describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}))

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises"
import { runAnalyzers } from "@eval/analysis/run-analyzers.js"
import type { SessionTrace } from "@ghx-dev/agent-profiler"

const mockTrace: SessionTrace = {
  sessionId: "sess-1",
  events: [],
  turns: [],
  summary: { totalTurns: 1, totalToolCalls: 2, totalTokens: { input: 100, output: 50, reasoning: 0 }, totalDuration: 1000 },
}

describe("runAnalyzers", () => {
  it("discovers trace files and runs analyzers on each", async () => {
    vi.mocked(readdir).mockImplementation(async (path) => {
      const p = String(path)
      if (p.endsWith("sessions")) return ["scenario-001"] as any
      if (p.includes("scenario-001")) return ["ghx-iter-0.json"] as any
      return [] as any
    })
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockTrace))
    vi.mocked(mkdir).mockResolvedValue(undefined)
    vi.mocked(writeFile).mockResolvedValue(undefined)

    const result = await runAnalyzers({
      runDir: "results",
      outputDir: "results/analysis",
    })

    expect(result.length).toBe(1)
    expect(result[0].sessionId).toBe("sess-1")
    expect(result[0].scenarioId).toBe("scenario-001")
    expect(result[0].mode).toBe("ghx")
    expect(writeFile).toHaveBeenCalled()
  })

  it("returns empty array when no sessions directory exists", async () => {
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

    const result = await runAnalyzers({ runDir: "missing", outputDir: "out" })
    expect(result).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/analysis/run-analyzers.test.ts`
Expected: FAIL (module doesn't exist)

**Step 3: Write the analyzers runner**

```typescript
// packages/eval/src/analysis/run-analyzers.ts
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { Analyzer, BaseScenario, SessionAnalysisBundle, SessionTrace } from "@ghx-dev/agent-profiler"
import {
  efficiencyAnalyzer,
  errorAnalyzer,
  reasoningAnalyzer,
  strategyAnalyzer,
  toolPatternAnalyzer,
} from "@ghx-dev/agent-profiler"
import type { AnalysisResult } from "@ghx-dev/agent-profiler"

export interface RunAnalyzersOptions {
  readonly runDir: string
  readonly outputDir: string
}

const BUILT_IN_ANALYZERS: readonly Analyzer[] = [
  reasoningAnalyzer,
  strategyAnalyzer,
  efficiencyAnalyzer,
  toolPatternAnalyzer,
  errorAnalyzer,
]

/**
 * Discovers session traces in {runDir}/sessions/ and runs all built-in
 * analyzers on each trace. Returns SessionAnalysisBundle records.
 */
export async function runAnalyzers(
  options: RunAnalyzersOptions,
): Promise<readonly SessionAnalysisBundle[]> {
  const sessionsDir = join(options.runDir, "sessions")
  let scenarioDirs: string[]

  try {
    scenarioDirs = await readdir(sessionsDir) as unknown as string[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }

  const bundles: SessionAnalysisBundle[] = []

  for (const scenarioId of scenarioDirs) {
    const scenarioDir = join(sessionsDir, scenarioId)
    let traceFiles: string[]
    try {
      traceFiles = (await readdir(scenarioDir) as unknown as string[]).filter((f) =>
        f.endsWith(".json"),
      )
    } catch {
      continue
    }

    for (const traceFile of traceFiles) {
      const content = await readFile(join(scenarioDir, traceFile), "utf-8")
      const trace = JSON.parse(content) as SessionTrace

      // Parse mode from filename: "{mode}-iter-{n}.json"
      const match = traceFile.match(/^(.+)-iter-\d+\.json$/)
      const mode = match?.[1] ?? "unknown"

      const stubScenario: BaseScenario = {
        id: scenarioId,
        name: scenarioId,
        description: "",
        prompt: "",
        timeoutMs: 0,
      }

      const results: Record<string, AnalysisResult> = {}
      for (const analyzer of BUILT_IN_ANALYZERS) {
        results[analyzer.name] = await analyzer.analyze(trace, stubScenario, mode)
      }

      const bundle: SessionAnalysisBundle = {
        sessionId: trace.sessionId,
        scenarioId,
        mode,
        model: "",
        results,
      }

      bundles.push(bundle)

      // Write bundle to output
      const outDir = join(options.outputDir, scenarioId)
      await mkdir(outDir, { recursive: true })
      const outFile = traceFile.replace(".json", "-analysis.json")
      await writeFile(join(outDir, outFile), JSON.stringify(bundle, null, 2), "utf-8")
    }
  }

  return bundles
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/analysis/run-analyzers.test.ts`
Expected: PASS

**Step 5: Update analyze CLI**

Replace `packages/eval/src/cli/analyze.ts`:

```typescript
import { join } from "node:path"
import { runAnalyzers } from "@eval/analysis/run-analyzers.js"
import { parseFlag } from "./parse-flags.js"

export async function analyze(argv: readonly string[]): Promise<void> {
  const runDir = parseFlag(argv, "--run-dir") ?? "results"
  const outputDir = parseFlag(argv, "--output") ?? join(runDir, "analysis")

  console.log(`Analyzing session traces in ${runDir}/sessions/...`)

  const bundles = await runAnalyzers({ runDir, outputDir })

  console.log(`Analysis complete: ${bundles.length} session(s) analyzed`)
  console.log(`Results written to ${outputDir}/`)
}
```

**Step 6: Update analyze CLI tests**

Replace `packages/eval/test/unit/cli/analyze.test.ts` with tests that verify the new behavior (calls runAnalyzers, prints results).

**Step 7: Run all tests**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/cli/analyze.test.ts test/unit/analysis/`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/eval/src/analysis/ packages/eval/src/cli/analyze.ts packages/eval/test/unit/analysis/ packages/eval/test/unit/cli/analyze.test.ts
git commit -m "feat(eval): implement eval analyze command"
```

---

### Task 8: Implement eval report

**Files:**
- Modify: `packages/eval/src/cli/report.ts:1-7`
- Create: `packages/eval/src/report/generate.ts`
- Create: `packages/eval/test/unit/report/generate.test.ts`
- Modify: `packages/eval/test/unit/cli/report.test.ts`

**Context:** The report command loads JSONL rows, optionally loads analysis bundles, and calls agent-profiler's `generateReport()`. Format filtering removes unwanted files after generation.

**Step 1: Write the failing test for generate**

```typescript
// packages/eval/test/unit/report/generate.test.ts
import { describe, expect, it, vi } from "vitest"

vi.mock("@ghx-dev/agent-profiler", async (importOriginal) => {
  const original = await importOriginal<typeof import("@ghx-dev/agent-profiler")>()
  return {
    ...original,
    readJsonlFile: vi.fn(),
    generateReport: vi.fn().mockResolvedValue("/reports/2026-02-28"),
  }
})

vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  rm: vi.fn(),
}))

import { readJsonlFile, generateReport } from "@ghx-dev/agent-profiler"
import { readdir, readFile } from "node:fs/promises"
import { generateEvalReport } from "@eval/report/generate.js"
import type { ProfileRow } from "@ghx-dev/agent-profiler"

const mockRow: ProfileRow = {
  runId: "run-1",
  scenarioId: "sc-001",
  mode: "ghx",
  model: "test-model",
  iteration: 0,
  startedAt: "2026-02-28T00:00:00Z",
  completedAt: "2026-02-28T00:01:00Z",
  tokens: { input: 100, output: 50, reasoning: 0 },
  timing: { totalMs: 60000, promptMs: 55000, scoringMs: 5000, segments: [] },
  toolCalls: { total: 5, byCategory: {}, failed: 0, retried: 0, errorRate: 0, records: [] },
  cost: { inputCost: 0.01, outputCost: 0.005, totalCost: 0.015 },
  success: true,
  checkpointsPassed: 1,
  checkpointsTotal: 1,
  checkpointDetails: [],
  outputValid: true,
  provider: "opencode",
  sessionId: "sess-1",
  agentTurns: 3,
  completionReason: "stop",
  extensions: {},
}

describe("generateEvalReport", () => {
  it("loads rows and calls generateReport", async () => {
    vi.mocked(readJsonlFile).mockResolvedValue([mockRow])
    vi.mocked(readdir).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }))

    const reportDir = await generateEvalReport({
      runDir: "results",
      resultsPaths: ["results/results.jsonl"],
      outputDir: "reports",
      format: "all",
    })

    expect(readJsonlFile).toHaveBeenCalled()
    expect(generateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-1",
        reportsDir: "reports",
      }),
    )
    expect(reportDir).toBe("/reports/2026-02-28")
  })

  it("loads analysis bundles when present", async () => {
    vi.mocked(readJsonlFile).mockResolvedValue([mockRow])
    vi.mocked(readdir).mockImplementation(async (path) => {
      if (String(path).endsWith("analysis")) return ["sc-001"] as any
      return ["ghx-iter-0-analysis.json"] as any
    })
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      sessionId: "sess-1",
      scenarioId: "sc-001",
      mode: "ghx",
      model: "",
      results: {},
    }))

    await generateEvalReport({
      runDir: "results",
      resultsPaths: ["results/results.jsonl"],
      outputDir: "reports",
      format: "all",
    })

    expect(generateReport).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisResults: expect.arrayContaining([
          expect.objectContaining({ sessionId: "sess-1" }),
        ]),
      }),
    )
  })
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/report/generate.test.ts`
Expected: FAIL

**Step 3: Write the report generator**

```typescript
// packages/eval/src/report/generate.ts
import { readdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import type { ProfileRow, SessionAnalysisBundle } from "@ghx-dev/agent-profiler"
import { generateReport, readJsonlFile } from "@ghx-dev/agent-profiler"

export interface GenerateReportOptions {
  readonly runDir: string
  readonly resultsPaths: readonly string[]
  readonly outputDir: string
  readonly format: "all" | "md" | "csv" | "json"
}

async function loadAnalysisBundles(runDir: string): Promise<readonly SessionAnalysisBundle[]> {
  const analysisDir = join(runDir, "analysis")
  let scenarioDirs: string[]

  try {
    scenarioDirs = await readdir(analysisDir) as unknown as string[]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }

  const bundles: SessionAnalysisBundle[] = []

  for (const scenarioId of scenarioDirs) {
    const scenarioDir = join(analysisDir, scenarioId)
    let files: string[]
    try {
      files = (await readdir(scenarioDir) as unknown as string[]).filter((f) =>
        f.endsWith("-analysis.json"),
      )
    } catch {
      continue
    }

    for (const file of files) {
      const content = await readFile(join(scenarioDir, file), "utf-8")
      bundles.push(JSON.parse(content) as SessionAnalysisBundle)
    }
  }

  return bundles
}

function parseRow(line: string): ProfileRow {
  return JSON.parse(line) as ProfileRow
}

/**
 * Loads JSONL result rows and optional analysis bundles, then generates
 * a full report via agent-profiler's generateReport().
 */
export async function generateEvalReport(options: GenerateReportOptions): Promise<string> {
  // Load rows from all JSONL paths
  const allRows: ProfileRow[] = []
  for (const path of options.resultsPaths) {
    const rows = await readJsonlFile(path, parseRow)
    allRows.push(...rows)
  }

  if (allRows.length === 0) {
    throw new Error("No profile rows found in the specified results file(s)")
  }

  // Extract runId from first row
  const runId = allRows[0].runId

  // Try to load analysis bundles
  const analysisResults = await loadAnalysisBundles(options.runDir)

  // Generate report
  const reportDir = await generateReport({
    runId,
    rows: allRows,
    reportsDir: options.outputDir,
    analysisResults: analysisResults.length > 0 ? analysisResults : undefined,
  })

  // Format filtering: remove unwanted output files
  if (options.format !== "all") {
    if (options.format !== "csv") {
      await rm(join(reportDir, "data", "results.csv"), { force: true })
    }
    if (options.format !== "json") {
      await rm(join(reportDir, "data", "results.json"), { force: true })
      await rm(join(reportDir, "data", "summary.json"), { force: true })
    }
    if (options.format !== "md") {
      for (const mdFile of ["index.md", "metrics.md", "analysis.md", "comparison.md"]) {
        await rm(join(reportDir, mdFile), { force: true })
      }
      // Remove scenario pages
      await rm(join(reportDir, "scenarios"), { recursive: true, force: true })
    }
  }

  return reportDir
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/report/generate.test.ts`
Expected: PASS

**Step 5: Update report CLI**

Replace `packages/eval/src/cli/report.ts`:

```typescript
import { join } from "node:path"
import { generateEvalReport } from "@eval/report/generate.js"
import { parseFlag, parseFlagAll } from "./parse-flags.js"

export async function report(argv: readonly string[]): Promise<void> {
  const runDir = parseFlag(argv, "--run-dir") ?? "results"
  const resultsPaths = parseFlagAll(argv, "--results")
  const format = (parseFlag(argv, "--format") ?? "all") as "all" | "md" | "csv" | "json"
  const outputDir = parseFlag(argv, "--output-dir") ?? join(runDir, "reports")

  // Default results path if none specified
  const paths = resultsPaths.length > 0 ? resultsPaths : [join(runDir, "results.jsonl")]

  console.log(`Generating report from ${paths.join(", ")}...`)

  const reportDir = await generateEvalReport({
    runDir,
    resultsPaths: paths,
    outputDir,
    format,
  })

  console.log(`Report generated at ${reportDir}`)
}
```

**Step 6: Update report CLI tests**

Replace `packages/eval/test/unit/cli/report.test.ts` with tests that verify new behavior (flag parsing, calls generateEvalReport).

**Step 7: Run all tests**

Run: `pnpm --filter @ghx-dev/eval exec vitest run test/unit/cli/report.test.ts test/unit/report/`
Expected: PASS

**Step 8: Commit**

```bash
git add packages/eval/src/report/ packages/eval/src/cli/report.ts packages/eval/test/unit/report/ packages/eval/test/unit/cli/report.test.ts
git commit -m "feat(eval): implement eval report command"
```

---

### Task 9: Export New Modules from Package Index

**Files:**
- Modify: `packages/eval/src/index.ts`

**Context:** Export the new seeder types and analysis/report functions so they are accessible to consumers.

**Step 1: Add exports**

Add to `packages/eval/src/index.ts`:

```typescript
// Seeders
export type { FixtureSeeder, SeedOptions } from "./fixture/seeders/types.js"
export { getSeeder, registerSeeder } from "./fixture/seeders/index.js"

// Analysis
export { runAnalyzers } from "./analysis/run-analyzers.js"

// Report
export { generateEvalReport } from "./report/generate.js"
```

**Step 2: Run typecheck**

Run: `pnpm --filter @ghx-dev/eval run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/eval/src/index.ts
git commit -m "feat(eval): export seeders, analyzers, and report from package index"
```

---

### Task 10: Full CI Verification

**Files:** None (verification only)

**Step 1: Run format**

Run: `pnpm --filter @ghx-dev/eval run format`

**Step 2: Run full CI**

Run: `pnpm run ci --outputStyle=static`
Expected: All checks pass

**Step 3: Run coverage check**

Run: `pnpm --filter @ghx-dev/eval run test:coverage`
Expected: Coverage >= 90% lines, functions, statements; >= 85% branches

**Step 4: Fix any issues found**

Address format, lint, type, or coverage issues. Iterate until CI is green.

**Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore(eval): fix lint/format/coverage issues"
```
