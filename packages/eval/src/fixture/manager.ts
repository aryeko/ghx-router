import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { type FixtureManifest, type FixtureResource, loadFixtureManifest } from "./manifest.js"

const execFileAsync = promisify(execFile)

export interface FixtureManagerOptions {
  /** GitHub repo containing fixture resources in `"owner/repo"` format. */
  readonly repo: string
  /** Path to the fixture manifest JSON file (absolute or relative to CWD). */
  readonly manifest: string
  /** When `true`, auto-seed fixtures if the manifest file is not found. */
  readonly seedIfMissing?: boolean
}

export interface FixtureStatus {
  readonly ok: readonly string[]
  readonly missing: readonly string[]
}

/**
 * Manages the lifecycle of GitHub fixture resources used by eval scenarios.
 *
 * Fixtures are PRs and issues in a dedicated GitHub repo with a known initial
 * state, tracked via a manifest file. The manager can check status, reset
 * branches to their original SHAs between iterations, and clean up resources
 * after a run.
 *
 * @example
 * ```typescript
 * import { FixtureManager } from "@ghx-dev/eval"
 *
 * const manager = new FixtureManager({
 *   repo: "owner/ghx-bench-fixtures",
 *   manifest: "fixtures/latest.json",
 * })
 * const { ok, missing } = await manager.status()
 * if (missing.length > 0) throw new Error(`Missing: ${missing.join(", ")}`)
 * ```
 */
export class FixtureManager {
  constructor(private readonly options: FixtureManagerOptions) {}

  async status(): Promise<FixtureStatus> {
    let manifest: FixtureManifest
    try {
      manifest = await loadFixtureManifest(this.options.manifest)
    } catch {
      return { ok: [], missing: [] }
    }

    const ok: string[] = []
    const missing: string[] = []

    for (const [fixtureType, resource] of Object.entries(manifest.fixtures)) {
      const exists = await this.checkResourceExists(resource)
      if (exists) {
        ok.push(fixtureType)
      } else {
        missing.push(fixtureType)
      }
    }

    return { ok, missing }
  }

  async reset(requires: readonly string[]): Promise<void> {
    const manifest = await loadFixtureManifest(this.options.manifest)

    for (const fixtureType of requires) {
      const resource = manifest.fixtures[fixtureType]
      if (!resource) {
        throw new Error(`Fixture type "${fixtureType}" not found in manifest`)
      }
      await this.resetFixture(resource)
    }
  }

  async seed(_scenarioIds: readonly string[]): Promise<void> {
    throw new Error("FixtureManager.seed(): not yet implemented — run eval fixture seed manually")
  }

  async cleanup(_options?: { all?: boolean }): Promise<void> {
    const parts = this.options.repo.split("/")
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(`Invalid repo format: ${this.options.repo}`)
    }

    const prs = await this.listLabeledResources("pr", "bench-fixture")
    const issues = await this.listLabeledResources("issue", "bench-fixture")

    for (const pr of prs) {
      await this.runGh(["pr", "close", String(pr), "--repo", this.options.repo])
    }

    for (const issue of issues) {
      await this.runGh(["issue", "close", String(issue), "--repo", this.options.repo])
    }
  }

  private async checkResourceExists(resource: FixtureResource): Promise<boolean> {
    try {
      if (resource.type.includes("pr")) {
        await this.runGh([
          "pr",
          "view",
          String(resource.number),
          "--repo",
          resource.repo,
          "--json",
          "number",
        ])
      } else {
        await this.runGh([
          "issue",
          "view",
          String(resource.number),
          "--repo",
          resource.repo,
          "--json",
          "number",
        ])
      }
      return true
    } catch {
      return false
    }
  }

  private async resetFixture(resource: FixtureResource): Promise<void> {
    const branch = resource.branch
    if (!branch) return

    const repoParts = resource.repo.split("/")
    if (repoParts.length !== 2 || !repoParts[0] || !repoParts[1]) return

    const originalSha = resource.metadata["originalSha"]
    if (typeof originalSha !== "string" || !originalSha) return

    // Force-push with retry (up to 3 attempts, 1s delay between retries)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.runGh([
          "api",
          `repos/${resource.repo}/git/refs/heads/${branch}`,
          "--method",
          "PATCH",
          "--field",
          `sha=${originalSha}`,
          "--field",
          "force=true",
        ])
        break
      } catch (error) {
        if (attempt === 3) throw error
        await sleep(1000)
      }
    }

    // Poll to verify the force-push took effect (up to 5 polls, 500ms apart)
    for (let poll = 0; poll < 5; poll++) {
      await sleep(500)
      const refData = await this.runGh(["api", `repos/${resource.repo}/git/refs/heads/${branch}`])
      const parsed = JSON.parse(refData) as { object?: { sha?: string } }
      if (parsed.object?.sha === originalSha) {
        return
      }
    }

    throw new Error(`Fixture reset for branch "${branch}" could not be verified after polling`)
  }

  private async listLabeledResources(
    resourceType: "pr" | "issue",
    label: string,
  ): Promise<number[]> {
    try {
      const output = await this.runGh([
        resourceType === "pr" ? "pr" : "issue",
        "list",
        "--label",
        label,
        "--repo",
        this.options.repo,
        "--json",
        "number",
        "--limit",
        "100",
      ])
      const parsed = JSON.parse(output) as Array<{ number: number }>
      return parsed.map((r) => r.number)
    } catch {
      return []
    }
  }

  private async runGh(args: readonly string[]): Promise<string> {
    const { stdout } = await execFileAsync("gh", args as string[])
    return stdout.trim()
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
