import type { FixtureManifest } from "../domain/types.js"
import { runGh, tryRunGh, tryRunGhJson } from "./gh-client.js"

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

export type CleanupAllResult = {
  closedIssues: number
  closedPrs: number
  deletedBranches: number
  deletedLabels: number
  deletedProjects: number
}

function listLabeledNumbers(repo: string, kind: "issue" | "pr"): number[] {
  const output = runGh([
    kind,
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "bench-fixture",
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

function closePrs(repo: string): number {
  const numbers = listLabeledNumbers(repo, "pr")
  for (const num of numbers) {
    tryRunGh(["pr", "close", String(num), "--repo", repo, "--delete-branch"])
  }
  return numbers.length
}

function closeIssues(repo: string): number {
  const numbers = listLabeledNumbers(repo, "issue")
  for (const num of numbers) {
    tryRunGh([
      "issue",
      "close",
      String(num),
      "--repo",
      repo,
      "--comment",
      "Benchmark fixture cleanup (--all)",
    ])
  }
  return numbers.length
}

function deleteOrphanBranches(repo: string): number {
  const refs = tryRunGhJson<{ ref: string }[]>([
    "api",
    `repos/${repo}/git/refs/heads`,
    "--jq",
    ".[].ref",
  ])

  if (refs === null || !Array.isArray(refs)) {
    // gh api with --jq returns newline-separated strings, try raw parsing
    const raw = tryRunGh(["api", `repos/${repo}/git/refs/heads`])
    if (raw === null) {
      return 0
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return 0
    }

    if (!Array.isArray(parsed)) {
      return 0
    }

    const branchRefs = (parsed as { ref?: string }[])
      .map((item) => (typeof item?.ref === "string" ? item.ref : null))
      .filter((ref): ref is string => ref !== null)
      .filter(
        (ref) =>
          ref.startsWith("refs/heads/bench-seed-") ||
          ref.startsWith("refs/heads/bench-review-seed-"),
      )

    let deleted = 0
    for (const ref of branchRefs) {
      const result = tryRunGh(["api", "--method", "DELETE", `repos/${repo}/git/${ref}`])
      if (result !== null) {
        deleted++
      } else {
        console.warn(`Warning: failed to delete branch ref ${ref}`)
      }
    }
    return deleted
  }

  return 0
}

function deleteLabels(repo: string): number {
  const output = tryRunGh(["label", "list", "--repo", repo, "--limit", "200", "--json", "name"])

  if (output === null || output.length === 0) {
    return 0
  }

  let labels: unknown
  try {
    labels = JSON.parse(output)
  } catch {
    return 0
  }

  if (!Array.isArray(labels)) {
    return 0
  }

  const seedLabels = (labels as { name?: string }[])
    .map((item) => (typeof item?.name === "string" ? item.name : null))
    .filter((name): name is string => name !== null)
    .filter((name) => name.startsWith("bench-seed:"))

  let deleted = 0
  for (const label of seedLabels) {
    const result = tryRunGh(["label", "delete", label, "--repo", repo, "--yes"])
    if (result !== null) {
      deleted++
    } else {
      console.warn(`Warning: failed to delete label ${label}`)
    }
  }
  return deleted
}

function deleteProjects(repo: string): number {
  const [owner] = repo.split("/")
  const output = tryRunGh([
    "project",
    "list",
    "--owner",
    owner ?? repo,
    "--format",
    "json",
    "--limit",
    "200",
  ])

  if (output === null || output.length === 0) {
    return 0
  }

  let projects: unknown
  try {
    projects = JSON.parse(output)
  } catch {
    return 0
  }

  // gh project list --format json returns { projects: [...] }
  const list = Array.isArray(projects)
    ? projects
    : typeof projects === "object" &&
        projects !== null &&
        Array.isArray((projects as { projects?: unknown }).projects)
      ? (projects as { projects: unknown[] }).projects
      : []

  const benchProjects = (list as { title?: string; number?: number }[]).filter(
    (p) => typeof p?.title === "string" && p.title.startsWith("GHX Bench Fixtures"),
  )

  let deleted = 0
  for (const project of benchProjects) {
    if (typeof project.number !== "number") {
      continue
    }
    const result = tryRunGh(["project", "delete", String(project.number), "--owner", owner ?? repo])
    if (result !== null) {
      deleted++
    } else {
      console.warn(`Warning: failed to delete project ${project.title}`)
    }
  }
  return deleted
}

export async function cleanupAllFixtures(repo: string): Promise<CleanupAllResult> {
  const closedPrs = closePrs(repo)
  const closedIssues = closeIssues(repo)
  const deletedBranches = deleteOrphanBranches(repo)
  const deletedLabels = deleteLabels(repo)
  const deletedProjects = deleteProjects(repo)

  return {
    closedIssues,
    closedPrs,
    deletedBranches,
    deletedLabels,
    deletedProjects,
  }
}
