import { runGhJson, tryRunGhJson } from "./gh-client.js"

function parseArrayResponse(value: unknown): unknown[] {
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

export function ensureProjectFixture(
  owner: string,
  issueUrl: string,
): { number: number; id: string; item_id: string; field_id: string; option_id: string } {
  const fixtureProjectTitle = "GHX Bench Fixtures"
  const listResult = runGhJson(["project", "list", "--owner", owner, "--format", "json"])
  const projects = parseArrayResponse(listResult)

  let project: { number: number; id: string } | null = null
  for (const entry of projects) {
    if (typeof entry !== "object" || entry === null) {
      continue
    }
    const value = entry as Record<string, unknown>
    if (typeof value.number === "number" && typeof value.id === "string") {
      const title = typeof value.title === "string" ? value.title : ""
      if (title.toLowerCase() === fixtureProjectTitle.toLowerCase()) {
        project = { number: value.number, id: value.id }
        break
      }
    }
  }

  if (!project) {
    const created = runGhJson([
      "project",
      "create",
      "--owner",
      owner,
      "--title",
      fixtureProjectTitle,
      "--format",
      "json",
    ]) as Record<string, unknown>
    project = {
      number: Number(created.number),
      id: String(created.id),
    }
  }

  const itemResult = tryRunGhJson([
    "project",
    "item-add",
    String(project.number),
    "--owner",
    owner,
    "--url",
    issueUrl,
    "--format",
    "json",
  ])
  const itemId =
    typeof itemResult === "object" &&
    itemResult !== null &&
    typeof (itemResult as { id?: unknown }).id === "string"
      ? String((itemResult as { id: string }).id)
      : ""

  const fieldResult = tryRunGhJson([
    "project",
    "field-list",
    String(project.number),
    "--owner",
    owner,
    "--format",
    "json",
  ])
  const fields = parseArrayResponse(fieldResult)
  let fieldId = ""
  let optionId = ""

  for (const entry of fields) {
    if (typeof entry !== "object" || entry === null) {
      continue
    }
    const value = entry as Record<string, unknown>
    const type = typeof value.type === "string" ? value.type : ""
    const id = typeof value.id === "string" ? value.id : ""
    const options = Array.isArray(value.options) ? value.options : []
    if (type === "ProjectV2SingleSelectField" && id.length > 0 && options.length > 0) {
      const firstOption = options[0]
      const candidate =
        typeof firstOption === "object" &&
        firstOption !== null &&
        typeof (firstOption as { id?: unknown }).id === "string"
          ? String((firstOption as { id: string }).id)
          : ""
      if (candidate.length > 0) {
        fieldId = id
        optionId = candidate
        break
      }
    }
  }

  return {
    number: project.number,
    id: project.id,
    item_id: itemId,
    field_id: fieldId,
    option_id: optionId,
  }
}
