import { runGhJson, tryRunGh, tryRunGhJson, tryRunGhWithToken } from "./gh-client.js"
import { parseArrayResponse, parseRepo } from "./gh-utils.js"
import { getAllPrThreadIds, getPrHeadSha } from "./seed-pr-basic.js"

export type PrWithMixedThreads = {
  id: string
  number: number
  resolved_count: number
  unresolved_count: number
}

const MIXED_THREAD_FILE_PATH = "src/utils/mixed-helpers.ts"

const MIXED_THREAD_FILE_CONTENT = `// Mixed-state helpers for data processing
export function processData(items: any[]) {
  return items.map(item => item.value)
}

export function filterActive(items: any[]) {
  return items.filter(item => item.active)
}

export function computeSum(numbers: any[]) {
  return numbers.reduce((a, b) => a + b, 0)
}

export function formatOutput(data: any) {
  return JSON.stringify(data)
}

export function parseInput(raw: string) {
  return JSON.parse(raw)
}

export function validateSchema(data: any, schema: any) {
  return true
}

export function transformData(data: any[]) {
  return data
}
`

const MIXED_THREAD_COMMENTS = [
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 2,
    body: "Avoid `any[]` — define a typed interface instead.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 6,
    body: "Use a proper type for `items` parameter rather than `any[]`.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 10,
    body: "Replace `any[]` with a typed `number[]` since only numbers are summed.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 14,
    body: "The `data` parameter should be typed — avoid `any`.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 18,
    body: "Add error handling around `JSON.parse` — it throws on invalid input.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 22,
    body: "This function always returns `true` — implement real schema validation or remove it.",
  },
  {
    path: MIXED_THREAD_FILE_PATH,
    line: 26,
    body: "The `data` and return types should not be `any[]` — define a proper transform type.",
  },
]

function resolveThreadId(repo: string, prNumber: number, index: number): string | null {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    "graphql",
    "-f",
    "query=query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$num){reviewThreads(first:20){nodes{id}}}}}",
    "-F",
    `owner=${owner}`,
    "-F",
    `repo=${name}`,
    "-F",
    `num=${prNumber}`,
  ])

  if (typeof result !== "object" || result === null) {
    return null
  }

  const nodes = (
    ((result as { data?: unknown }).data as { repository?: unknown } | undefined)?.repository as
      | { pullRequest?: unknown }
      | undefined
  )?.pullRequest as { reviewThreads?: unknown } | undefined

  const threadNodes = parseArrayResponse((nodes?.reviewThreads ?? {}) as unknown)
  const node = threadNodes[index]
  if (typeof node !== "object" || node === null) {
    return null
  }
  const id = (node as { id?: unknown }).id
  return typeof id === "string" && id.length > 0 ? id : null
}

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

export function createPrWithMixedThreads(
  repo: string,
  seedId: string,
  seedLabel: string,
  reviewerToken: string,
): PrWithMixedThreads {
  const { owner, name } = parseRepo(repo)
  const branch = `bench-mixed-seed-${seedId}`

  const refResult = runGhJson(["api", `repos/${owner}/${name}/git/ref/heads/main`]) as Record<
    string,
    unknown
  >
  const object = refResult.object as Record<string, unknown>
  const baseSha = String(object.sha ?? "")
  if (baseSha.length === 0) {
    throw new Error("unable to resolve base sha for mixed-thread PR creation")
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

  const encodedContent = Buffer.from(MIXED_THREAD_FILE_CONTENT, "utf8").toString("base64")
  const existingFile = tryRunGhJson<{ sha?: string }>([
    "api",
    `repos/${owner}/${name}/contents/${MIXED_THREAD_FILE_PATH}?ref=${branch}`,
  ])
  const existingFileSha =
    typeof existingFile?.sha === "string" && existingFile.sha.length > 0 ? existingFile.sha : null

  const contentArgs = [
    "api",
    `repos/${owner}/${name}/contents/${MIXED_THREAD_FILE_PATH}`,
    "--method",
    "PUT",
    "-f",
    `message=feat: add mixed helpers`,
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
      `title=Add mixed helpers (${seedLabel})`,
      "-f",
      "body=Adds mixed-state helpers. Please review.",
      "-f",
      `head=${branch}`,
      "-f",
      "base=main",
    ]) as Record<string, unknown>

    prNumber = Number(prResult.number)
    prNodeId = String(prResult.node_id ?? "")

    if (!Number.isInteger(prNumber) || prNumber <= 0 || prNodeId.length === 0) {
      throw new Error("failed to create mixed-thread fixture PR")
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
    throw new Error("unable to resolve head sha for mixed-thread review comments")
  }

  const existingThreadCount = countPrThreads(repo, prNumber)
  let addedThreads = 0
  if (existingThreadCount < MIXED_THREAD_COMMENTS.length) {
    for (const comment of MIXED_THREAD_COMMENTS.slice(existingThreadCount)) {
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

  // Resolve the first 4 threads
  const totalThreads = existingThreadCount + addedThreads
  const resolveCount = Math.min(4, totalThreads)
  for (let i = 0; i < resolveCount; i++) {
    const threadId = resolveThreadId(repo, prNumber, i)
    if (threadId) {
      tryRunGhWithToken(
        [
          "api",
          "graphql",
          "-f",
          "query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
          "-F",
          `threadId=${threadId}`,
        ],
        reviewerToken,
      )
    }
  }

  return {
    id: prNodeId,
    number: prNumber,
    resolved_count: resolveCount,
    unresolved_count: Math.max(0, totalThreads - resolveCount),
  }
}

function deletePrReplyComments(repo: string, prNumber: number): void {
  const { owner, name } = parseRepo(repo)
  const result = tryRunGhJson([
    "api",
    `repos/${owner}/${name}/pulls/${prNumber}/comments?per_page=100`,
  ])
  const comments = parseArrayResponse(result)
  for (const comment of comments) {
    if (typeof comment !== "object" || comment === null) continue
    const c = comment as Record<string, unknown>
    if (typeof c.in_reply_to_id !== "number") continue
    const id = c.id
    if (typeof id !== "number") continue
    tryRunGh(["api", `repos/${owner}/${name}/pulls/comments/${id}`, "--method", "DELETE"])
  }
}

export function resetMixedPrThreads(repo: string, prNumber: number, token: string): void {
  deletePrReplyComments(repo, prNumber)

  const threadIds = getAllPrThreadIds(repo, prNumber)

  // Unresolve all 7 threads
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
      token,
    )
  }

  // Re-resolve the first 4
  for (let i = 0; i < Math.min(4, threadIds.length); i++) {
    const threadId = threadIds[i]
    if (threadId) {
      tryRunGhWithToken(
        [
          "api",
          "graphql",
          "-f",
          "query=mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}",
          "-F",
          `threadId=${threadId}`,
        ],
        token,
      )
    }
  }
}
