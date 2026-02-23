import type { FixtureManifest } from "../domain/types.js"
import { runGh, tryRunGh } from "./gh-client.js"

type CleanupResult = {
  closedIssues: number
  closedPrs: number
  deletedBranches: number
}

function listOpenSeededIssues(repo: string, seedLabel: string): number[] {
  const output = runGh([
    "issue",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "bench-fixture",
    "--label",
    seedLabel,
    "--limit",
    "200",
    "--json",
    "number",
  ])

  const parsed = output.length === 0 ? [] : JSON.parse(output)
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null
      }
      const value = (item as { number?: unknown }).number
      return typeof value === "number" ? value : null
    })
    .filter((value): value is number => value !== null)
}

function extractSeedId(manifest: FixtureManifest): string {
  const metadata = manifest.resources.metadata
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return "default"
  }

  const seedId = (metadata as { seed_id?: unknown }).seed_id
  return typeof seedId === "string" && seedId.length > 0 ? seedId : "default"
}

function listOpenSeededPrs(repo: string, seedLabel: string): number[] {
  const output = tryRunGh([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "bench-fixture",
    "--label",
    seedLabel,
    "--limit",
    "200",
    "--json",
    "number",
  ])

  if (output === null || output.length === 0) {
    return []
  }

  const parsed = JSON.parse(output)
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
    .map((item) => {
      if (typeof item !== "object" || item === null) {
        return null
      }
      const value = (item as { number?: unknown }).number
      return typeof value === "number" ? value : null
    })
    .filter((value): value is number => value !== null)
}

export async function cleanupSeededFixtures(manifest: FixtureManifest): Promise<CleanupResult> {
  const repo = manifest.repo.full_name
  const seedId = extractSeedId(manifest)
  const seedLabel = `bench-seed:${seedId}`

  const issueNumbers = listOpenSeededIssues(repo, seedLabel)
  for (const issueNumber of issueNumbers) {
    runGh([
      "issue",
      "close",
      String(issueNumber),
      "--repo",
      repo,
      "--comment",
      `Benchmark fixture cleanup (${seedLabel})`,
    ])
  }

  const prNumbers = listOpenSeededPrs(repo, seedLabel)
  for (const prNumber of prNumbers) {
    tryRunGh(["pr", "close", String(prNumber), "--repo", repo, "--delete-branch"])
  }

  const branchNames = [`bench-seed-${seedId}`, `bench-review-seed-${seedId}`]
  let deletedBranches = 0
  for (const branch of branchNames) {
    const result = tryRunGh(["api", "--method", "DELETE", `repos/${repo}/git/refs/heads/${branch}`])
    if (result !== null) {
      deletedBranches++
    }
  }

  return {
    closedIssues: issueNumbers.length,
    closedPrs: prNumbers.length,
    deletedBranches,
  }
}
