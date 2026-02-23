import { runGhJson, runGhJsonWithToken, tryRunGh, tryRunGhJson } from "./gh-client.js"
import { parseArrayResponse, parseRepo } from "./gh-utils.js"
import { getPrHeadSha } from "./seed-pr-basic.js"

export type PrWithBugs = {
  id: string
  number: number
}

const BUGS_FILE_PATH = "src/utils/stats.ts"

// Bug 1 (line 4): division by zero — no empty-array guard on average()
// Bug 2 (line 8): missing await on fetch() — res is Promise<Response>, not Response
// Bug 3 (line 12): hardcoded credential "hunter2"
const BUGS_FILE_CONTENT = `// Statistical utility functions

export function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export async function loadUser(id: string) {
  const res = fetch(\`/api/users/\${id}\`)
  return res.json()
}

const DB_PASSWORD = "hunter2"
export function connect() {
  return { password: DB_PASSWORD }
}
`

export function createPrWithBugs(
  repo: string,
  seedId: string,
  seedLabel: string,
  reviewerToken: string,
): PrWithBugs {
  const { owner, name } = parseRepo(repo)
  const branch = `bench-bugs-seed-${seedId}`

  const refResult = runGhJson(["api", `repos/${owner}/${name}/git/ref/heads/main`]) as Record<
    string,
    unknown
  >
  const object = refResult.object as Record<string, unknown>
  const baseSha = String(object.sha ?? "")
  if (baseSha.length === 0) {
    throw new Error("unable to resolve base sha for bugs PR creation")
  }

  tryRunGhJson([
    "api",
    `repos/${owner}/${name}/git/refs`,
    "--method",
    "POST",
    "-f",
    `ref=refs/heads/${branch}`,
    "-f",
    `sha=${baseSha}`,
  ])

  const encodedContent = Buffer.from(BUGS_FILE_CONTENT, "utf8").toString("base64")
  const existingFile = tryRunGhJson<{ sha?: string }>([
    "api",
    `repos/${owner}/${name}/contents/${BUGS_FILE_PATH}?ref=${branch}`,
  ])
  const existingFileSha =
    typeof existingFile?.sha === "string" && existingFile.sha.length > 0 ? existingFile.sha : null

  runGhJson([
    "api",
    `repos/${owner}/${name}/contents/${BUGS_FILE_PATH}`,
    "--method",
    "PUT",
    "-f",
    `message=feat: add stats utilities`,
    "-f",
    `content=${encodedContent}`,
    "-f",
    `branch=${branch}`,
    ...(existingFileSha ? ["-f", `sha=${existingFileSha}`] : []),
  ])

  const existingPrResult = tryRunGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--head",
    branch,
    "--limit",
    "1",
    "--json",
    "id,number",
  ])
  const existingPrs = parseArrayResponse(existingPrResult)
  const existingPr = existingPrs[0]

  let prNumber: number
  let prNodeId: string

  if (
    typeof existingPr === "object" &&
    existingPr !== null &&
    typeof (existingPr as Record<string, unknown>).id === "string" &&
    typeof (existingPr as Record<string, unknown>).number === "number"
  ) {
    prNodeId = String((existingPr as Record<string, unknown>).id)
    prNumber = Number((existingPr as Record<string, unknown>).number)
  } else {
    const prResult = runGhJsonWithToken(
      [
        "api",
        `repos/${owner}/${name}/pulls`,
        "--method",
        "POST",
        "-f",
        `title=Add stats utilities (${seedLabel})`,
        "-f",
        "body=Adds statistical utility functions. Please review.",
        "-f",
        `head=${branch}`,
        "-f",
        "base=main",
      ],
      reviewerToken,
    ) as Record<string, unknown>

    prNumber = Number(prResult.number)
    prNodeId = String(prResult.node_id ?? "")

    if (!Number.isInteger(prNumber) || prNumber <= 0 || prNodeId.length === 0) {
      throw new Error("failed to create bugs fixture PR")
    }

    tryRunGh([
      "api",
      `repos/${owner}/${name}/issues/${prNumber}/labels`,
      "--method",
      "POST",
      "-f",
      "labels[]=bench-fixture",
      "-f",
      `labels[]=${seedLabel}`,
    ])
  }

  const headSha = getPrHeadSha(repo, prNumber)
  if (!headSha) {
    throw new Error("unable to resolve head sha for bugs PR")
  }

  return { id: prNodeId, number: prNumber }
}

export function resetPrBugs(repo: string, prNumber: number, _token: string): void {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    `repos/${owner}/${name}/pulls/${prNumber}/comments?per_page=100`,
  ])
  const comments = parseArrayResponse(result)
  for (const comment of comments) {
    if (typeof comment !== "object" || comment === null) continue
    const id = (comment as Record<string, unknown>).id
    if (typeof id !== "number") continue
    tryRunGh(["api", `repos/${owner}/${name}/pulls/comments/${id}`, "--method", "DELETE"])
  }
}
