import { runGhJson, tryRunGh, tryRunGhJson, tryRunGhWithToken } from "./gh-client.js"
import { parseArrayResponse, parseRepo } from "./gh-utils.js"
import { findPrThreadId, getAllPrThreadIds, getPrHeadSha } from "./seed-pr-basic.js"

export type PrWithReviews = { id: string; number: number; thread_count: number }

const REVIEW_PR_FILE_PATH = "src/utils/helpers.ts"

const REVIEW_PR_FILE_CONTENT = `// Utility helpers for data processing
export function processItems(items: any[]) {
  let result = []
  for (let i = 0; i < items.length; i++) {
    if (items[i] != null) {
      result.push(items[i].name.toUpperCase())
    }
  }
  return result
}

export function fetchData(url: string) {
  // TODO: add error handling
  return fetch(url).then(res => res.json())
}

export function formatDate(d: Date) {
  return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate()
}
`

const REVIEW_COMMENTS = [
  {
    path: REVIEW_PR_FILE_PATH,
    line: 2,
    body: "Please use a proper type instead of `any[]`. Consider defining an `Item` interface with a `name: string` field.",
  },
  {
    path: REVIEW_PR_FILE_PATH,
    line: 3,
    body: "Use `const` instead of `let` since `result` is only pushed to, never reassigned. Also consider using `.filter().map()` instead of the imperative loop.",
  },
  {
    path: REVIEW_PR_FILE_PATH,
    line: 16,
    body: "This function has no error handling. Please add a try/catch and handle non-OK responses (check `res.ok` before calling `.json()`).",
  },
  {
    path: REVIEW_PR_FILE_PATH,
    line: 20,
    body: "`getMonth()` is zero-indexed, so January returns 0. Use `d.getMonth() + 1` and pad single digits with a leading zero for ISO format.",
  },
]

function countPrThreads(repo: string, prNumber: number): number {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    "graphql",
    "-f",
    "query=query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:100){totalCount}}}}",
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${name}`,
    "-F",
    `num=${prNumber}`,
  ])

  if (typeof result !== "object" || result === null) {
    return 0
  }

  const data = (result as { data?: unknown }).data as Record<string, unknown> | undefined
  const repository = data?.repository as Record<string, unknown> | undefined
  const pullRequest = repository?.pullRequest as Record<string, unknown> | undefined
  const reviewThreads = pullRequest?.reviewThreads as Record<string, unknown> | undefined
  const totalCount = reviewThreads?.totalCount

  return typeof totalCount === "number" ? totalCount : 0
}

export function createPrWithReviews(
  repo: string,
  seedId: string,
  seedLabel: string,
  reviewerToken: string,
): PrWithReviews {
  const { owner, name } = parseRepo(repo)
  const branch = `bench-review-seed-${seedId}`

  const refResult = runGhJson(["api", `repos/${owner}/${name}/git/ref/heads/main`]) as Record<
    string,
    unknown
  >
  const object = refResult.object as Record<string, unknown>
  const baseSha = String(object.sha ?? "")
  if (baseSha.length === 0) {
    throw new Error("unable to resolve base sha for review PR creation")
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

  const encodedContent = Buffer.from(REVIEW_PR_FILE_CONTENT, "utf8").toString("base64")
  const existingFile = tryRunGhJson<{ sha?: string }>([
    "api",
    `repos/${owner}/${name}/contents/${REVIEW_PR_FILE_PATH}?ref=${branch}`,
  ])
  const existingFileSha =
    typeof existingFile?.sha === "string" && existingFile.sha.length > 0 ? existingFile.sha : null

  const contentArgs = [
    "api",
    `repos/${owner}/${name}/contents/${REVIEW_PR_FILE_PATH}`,
    "--method",
    "PUT",
    "-f",
    `message=feat: add utility helpers`,
    "-f",
    `content=${encodedContent}`,
    "-f",
    `branch=${branch}`,
  ]
  if (existingFileSha) {
    contentArgs.push("-f", `sha=${existingFileSha}`)
  }
  runGhJson(contentArgs)

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
    const prResult = runGhJson([
      "api",
      `repos/${owner}/${name}/pulls`,
      "--method",
      "POST",
      "-f",
      `title=Add utility helpers (${seedLabel})`,
      "-f",
      "body=Adds data processing utility functions. Please review.",
      "-f",
      `head=${branch}`,
      "-f",
      "base=main",
    ]) as Record<string, unknown>

    prNumber = Number(prResult.number)
    prNodeId = String(prResult.node_id ?? "")

    if (!Number.isInteger(prNumber) || prNumber <= 0 || prNodeId.length === 0) {
      throw new Error("failed to create review fixture PR")
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
    throw new Error("unable to resolve head sha for review comments")
  }

  const existingThreadCount = countPrThreads(repo, prNumber)
  let addedThreads = 0
  if (existingThreadCount < REVIEW_COMMENTS.length) {
    for (const comment of REVIEW_COMMENTS.slice(existingThreadCount)) {
      const created = tryRunGhWithToken(
        [
          "api",
          `repos/${owner}/${name}/pulls/${prNumber}/comments`,
          "--method",
          "POST",
          "-f",
          `body=${comment.body}`,
          "-f",
          `commit_id=${headSha}`,
          "-f",
          `path=${comment.path}`,
          "-F",
          `line=${comment.line}`,
          "-f",
          "side=RIGHT",
        ],
        reviewerToken,
      )
      if (created !== null) {
        addedThreads++
      }
    }
  }

  const firstThreadId = findPrThreadId(repo, prNumber)
  if (firstThreadId) {
    tryRunGhWithToken(
      [
        "api",
        "graphql",
        "-f",
        "query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
        "-F",
        `threadId=${firstThreadId}`,
      ],
      reviewerToken,
    )
  }

  return {
    id: prNodeId,
    number: prNumber,
    thread_count: existingThreadCount + addedThreads,
  }
}

export function resetPrReviewThreads(repo: string, prNumber: number, reviewerToken: string): void {
  const threadIds = getAllPrThreadIds(repo, prNumber)

  for (const threadId of threadIds) {
    tryRunGhWithToken(
      [
        "api",
        "graphql",
        "-f",
        "query=mutation($threadId:ID!){unresolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
        "-F",
        `threadId=${threadId}`,
      ],
      reviewerToken,
    )
  }

  const firstThreadId = threadIds[0]
  if (firstThreadId) {
    tryRunGhWithToken(
      [
        "api",
        "graphql",
        "-f",
        "query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
        "-F",
        `threadId=${firstThreadId}`,
      ],
      reviewerToken,
    )
  }
}
