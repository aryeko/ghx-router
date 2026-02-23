import { runGhJson } from "./gh-client.js"
import { parseRepo } from "./gh-utils.js"

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
