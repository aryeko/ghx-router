export function parseWorkflowRunIdFromLink(link: string): number | null {
  const match = /\/actions\/runs\/(\d+)/.exec(link)
  if (!match) {
    return null
  }

  const runId = Number(match[1])
  return Number.isInteger(runId) && runId > 0 ? runId : null
}

export function parseWorkflowRunCreatedAtMs(entry: Record<string, unknown>): number {
  const createdAt = typeof entry.createdAt === "string" ? Date.parse(entry.createdAt) : Number.NaN
  return Number.isFinite(createdAt) ? createdAt : 0
}

export function parseCheckRunIdFromJob(entry: Record<string, unknown>): number | null {
  const directIdCandidates = [entry.checkRunId, entry.check_run_id]
  for (const candidate of directIdCandidates) {
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0) {
      return Number(candidate)
    }
  }

  const urlCandidates = [entry.checkRunUrl, entry.check_run_url]
  for (const candidate of urlCandidates) {
    if (typeof candidate !== "string") {
      continue
    }

    const match = candidate.match(/\/check-runs\/(\d+)(?:[/?#]|$)/)
    if (!match) {
      continue
    }

    const parsed = Number(match[1])
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
}
