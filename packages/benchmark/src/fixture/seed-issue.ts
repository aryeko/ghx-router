import { runGh, runGhJson } from "./gh-client.js"

function parseRepo(repo: string): { owner: string; name: string } {
  const parts = repo.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repo format: ${repo}; expected owner/name`)
  }

  const [owner, name] = parts

  return { owner, name }
}

export function findOrCreateIssue(
  repo: string,
  seedLabel: string,
): { id: string; number: number; url: string } {
  const { owner, name } = parseRepo(repo)
  const listResult = runGhJson([
    "issue",
    "list",
    "--repo",
    repo,
    "--label",
    "bench-fixture",
    "--label",
    seedLabel,
    "--state",
    "open",
    "--limit",
    "1",
    "--json",
    "id,number,url",
  ])

  const existingItems = Array.isArray(listResult)
    ? listResult
    : Array.isArray((listResult as { [k: string]: unknown }).items)
      ? ((listResult as { items: unknown[] }).items ?? [])
      : []

  const existing = existingItems[0]
  if (typeof existing === "object" && existing !== null) {
    const issue = existing as Record<string, unknown>
    if (
      typeof issue.id === "string" &&
      typeof issue.number === "number" &&
      typeof issue.url === "string"
    ) {
      return {
        id: issue.id,
        number: issue.number,
        url: issue.url,
      }
    }
  }

  const title = `Benchmark fixture issue (${seedLabel})`
  const createResult = runGhJson([
    "api",
    `repos/${owner}/${name}/issues`,
    "--method",
    "POST",
    "-f",
    `title=${title}`,
    "-f",
    "body=Managed by benchmark fixture seeding.",
    "-f",
    "labels[]=bench-fixture",
    "-f",
    `labels[]=${seedLabel}`,
  ])

  const createdIssue = createResult as Record<string, unknown>
  const createdNumber = Number(createdIssue.number)
  if (!Number.isInteger(createdNumber) || createdNumber <= 0) {
    throw new Error("failed to create fixture issue")
  }

  const resolvedIssue = runGhJson([
    "issue",
    "view",
    String(createdNumber),
    "--repo",
    repo,
    "--json",
    "id,number,url",
  ]) as Record<string, unknown>

  return {
    id: String(resolvedIssue.id),
    number: Number(resolvedIssue.number),
    url: String(resolvedIssue.url),
  }
}

export function createIssueTriage(repo: string): {
  id: string
  number: number
  url: string
} {
  const { owner, name } = parseRepo(repo)

  runGh(["label", "create", "triage", "--repo", repo, "--color", "e4e669", "--force"])
  runGh(["label", "create", "feature-request", "--repo", repo, "--color", "0075ca", "--force"])

  // Find existing triage fixture issue by bench-fixture label + title search
  const listResult = runGhJson([
    "issue",
    "list",
    "--repo",
    repo,
    "--label",
    "bench-fixture",
    "--search",
    "Triage fixture in:title",
    "--state",
    "open",
    "--limit",
    "1",
    "--json",
    "id,number,url",
  ])

  const existingItems = Array.isArray(listResult)
    ? listResult
    : Array.isArray((listResult as { [k: string]: unknown }).items)
      ? ((listResult as { items: unknown[] }).items ?? [])
      : []

  let issueNumber = 0
  let issueId = ""
  let issueUrl = ""

  const existing = existingItems[0]
  if (typeof existing === "object" && existing !== null) {
    const issue = existing as Record<string, unknown>
    if (
      typeof issue.id === "string" &&
      typeof issue.number === "number" &&
      typeof issue.url === "string"
    ) {
      issueNumber = issue.number
      issueId = issue.id
      issueUrl = issue.url
    }
  }

  if (issueNumber === 0) {
    const createResult = runGhJson([
      "api",
      `repos/${owner}/${name}/issues`,
      "--method",
      "POST",
      "-f",
      "title=Triage fixture issue",
      "-f",
      "body=Managed by benchmark fixture seeding.",
      "-f",
      "labels[]=bench-fixture",
    ]) as Record<string, unknown>

    issueNumber = Number(createResult.number)
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      throw new Error("failed to create triage fixture issue")
    }

    const resolved = runGhJson([
      "issue",
      "view",
      String(issueNumber),
      "--repo",
      repo,
      "--json",
      "id,number,url",
    ]) as Record<string, unknown>

    issueId = String(resolved.id)
    issueUrl = String(resolved.url)
  }

  // Apply triage and feature-request labels
  runGhJson([
    "api",
    `repos/${owner}/${name}/issues/${issueNumber}/labels`,
    "--method",
    "POST",
    "-f",
    "labels[]=triage",
    "-f",
    "labels[]=feature-request",
  ])

  return { id: issueId, number: issueNumber, url: issueUrl }
}

export function resetIssueTriage(repo: string, issueNumber: number, _token: string): void {
  const { owner, name } = parseRepo(repo)

  // Delete all comments on the issue
  const comments = runGhJson([
    "api",
    `repos/${owner}/${name}/issues/${issueNumber}/comments?per_page=100`,
  ]) as unknown[]

  const commentList = Array.isArray(comments) ? comments : []
  for (const comment of commentList) {
    const c = comment as Record<string, unknown>
    if (typeof c.id === "number") {
      runGh(["api", `repos/${owner}/${name}/issues/comments/${c.id}`, "--method", "DELETE"])
    }
  }

  // Reset labels back to bench-fixture + triage + feature-request
  runGhJson([
    "api",
    `repos/${owner}/${name}/issues/${issueNumber}/labels`,
    "--method",
    "PUT",
    "-f",
    "labels[]=bench-fixture",
    "-f",
    "labels[]=triage",
    "-f",
    "labels[]=feature-request",
  ])
}
