import { runGhJson } from "./gh-client.js"

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
