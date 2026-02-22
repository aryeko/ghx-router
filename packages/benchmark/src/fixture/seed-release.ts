import { runGhJson } from "./gh-client.js"

function parseRepo(repo: string): { owner: string; name: string } {
  const parts = repo.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repo format: ${repo}; expected owner/name`)
  }

  const [owner, name] = parts

  return { owner, name }
}

export function findLatestDraftRelease(repo: string): { id: number; tag_name: string } | null {
  const { owner, name } = parseRepo(repo)
  const releasesResult = runGhJson(["api", `repos/${owner}/${name}/releases?per_page=20`])
  const releases = Array.isArray(releasesResult) ? releasesResult : []

  for (const item of releases) {
    if (typeof item !== "object" || item === null) {
      continue
    }
    const release = item as Record<string, unknown>
    if (
      release.draft === true &&
      typeof release.id === "number" &&
      typeof release.tag_name === "string"
    ) {
      return {
        id: release.id,
        tag_name: release.tag_name,
      }
    }
  }

  return null
}
