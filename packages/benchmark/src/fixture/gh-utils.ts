export function parseRepo(repo: string): { owner: string; name: string } {
  const parts = repo.split("/")
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`invalid repo format: ${repo}; expected owner/name`)
  }

  const [owner, name] = parts

  return { owner, name }
}

export function parseArrayResponse(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === "object" && value !== null) {
    const items = (value as { items?: unknown[] }).items
    if (Array.isArray(items)) {
      return items
    }

    const projects = (value as { projects?: unknown[] }).projects
    if (Array.isArray(projects)) {
      return projects
    }

    const nodes = (value as { nodes?: unknown[] }).nodes
    if (Array.isArray(nodes)) {
      return nodes
    }

    const fields = (value as { fields?: unknown[] }).fields
    if (Array.isArray(fields)) {
      return fields
    }
  }

  return []
}
