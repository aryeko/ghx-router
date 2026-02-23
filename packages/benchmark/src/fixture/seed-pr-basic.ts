import { runGhJson, tryRunGh, tryRunGhJson } from "./gh-client.js"
import { parseArrayResponse, parseRepo } from "./gh-utils.js"

export function findSeededPr(
  repo: string,
  seedLabel: string,
): { id: string; number: number } | null {
  const listResult = tryRunGhJson([
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--label",
    "bench-fixture",
    "--label",
    seedLabel,
    "--limit",
    "1",
    "--json",
    "id,number",
  ])

  const list = parseArrayResponse(listResult)
  const first = list[0]
  if (typeof first !== "object" || first === null) {
    return null
  }

  const pr = first as Record<string, unknown>
  if (typeof pr.id !== "string" || typeof pr.number !== "number") {
    return null
  }

  return {
    id: pr.id,
    number: pr.number,
  }
}

export function createSeedPr(
  repo: string,
  seedId: string,
  seedLabel: string,
): { id: string; number: number } {
  const { owner, name } = parseRepo(repo)
  const branch = `bench-seed-${seedId}`
  const contentPath = `.bench/seed-${seedId}.md`

  const refResult = runGhJson(["api", `repos/${owner}/${name}/git/ref/heads/main`]) as Record<
    string,
    unknown
  >
  const object = refResult.object as Record<string, unknown>
  const baseSha = String(object.sha ?? "")
  if (baseSha.length === 0) {
    throw new Error("unable to resolve base sha for fixture PR creation")
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

  const body = `# Benchmark fixture seed\nseed: ${seedId}\n`
  const encodedBody = Buffer.from(body, "utf8").toString("base64")

  const existingFile = tryRunGhJson<{ sha?: string }>([
    "api",
    `repos/${owner}/${name}/contents/${contentPath}?ref=${branch}`,
  ])
  const existingFileSha =
    typeof existingFile?.sha === "string" && existingFile.sha.length > 0 ? existingFile.sha : null

  runGhJson([
    "api",
    `repos/${owner}/${name}/contents/${contentPath}`,
    "--method",
    "PUT",
    "-f",
    `message=chore: seed fixtures (${seedId})`,
    "-f",
    `content=${encodedBody}`,
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
  if (typeof existingPr === "object" && existingPr !== null) {
    const value = existingPr as Record<string, unknown>
    if (typeof value.id === "string" && typeof value.number === "number") {
      return {
        id: value.id,
        number: value.number,
      }
    }
  }

  const prResult = runGhJson([
    "api",
    `repos/${owner}/${name}/pulls`,
    "--method",
    "POST",
    "-f",
    `title=Benchmark fixture PR (${seedLabel})`,
    "-f",
    "body=Managed by benchmark fixture seeding.",
    "-f",
    `head=${branch}`,
    "-f",
    "base=main",
  ]) as Record<string, unknown>

  const number = Number(prResult.number)
  const nodeId = String(prResult.node_id ?? "")

  if (!Number.isInteger(number) || number <= 0 || nodeId.length === 0) {
    throw new Error("failed to create fixture PR")
  }

  tryRunGh([
    "api",
    `repos/${owner}/${name}/issues/${number}/labels`,
    "--method",
    "POST",
    "-f",
    "labels[]=bench-fixture",
    "-f",
    `labels[]=${seedLabel}`,
  ])

  return {
    id: nodeId,
    number,
  }
}

export function getPrHeadSha(repo: string, prNumber: number): string | null {
  const result = tryRunGhJson([
    "pr",
    "view",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "headRefOid",
  ])
  if (typeof result !== "object" || result === null) {
    return null
  }

  const sha = (result as { headRefOid?: unknown }).headRefOid
  return typeof sha === "string" && sha.length > 0 ? sha : null
}

export function findPrThreadId(repo: string, prNumber: number): string | null {
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
      | {
          pullRequest?: unknown
        }
      | undefined
  )?.pullRequest as { reviewThreads?: unknown } | undefined

  const threadNodes = parseArrayResponse((nodes?.reviewThreads ?? {}) as unknown)
  const first = threadNodes[0]
  if (typeof first !== "object" || first === null) {
    return null
  }

  const id = (first as { id?: unknown }).id
  return typeof id === "string" && id.length > 0 ? id : null
}

export function getAllPrThreadIds(repo: string, prNumber: number): string[] {
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
    return []
  }

  const nodes = (
    ((result as { data?: unknown }).data as { repository?: unknown } | undefined)?.repository as
      | { pullRequest?: unknown }
      | undefined
  )?.pullRequest as { reviewThreads?: unknown } | undefined

  const threadNodes = parseArrayResponse((nodes?.reviewThreads ?? {}) as unknown)
  return threadNodes
    .filter(
      (node): node is { id: string } =>
        typeof node === "object" &&
        node !== null &&
        typeof (node as { id?: unknown }).id === "string",
    )
    .map((node) => node.id)
}

export function ensurePrThread(repo: string, prNumber: number, seedId: string): string {
  const existingThreadId = findPrThreadId(repo, prNumber)
  if (existingThreadId) {
    return existingThreadId
  }

  const headSha = getPrHeadSha(repo, prNumber)
  if (headSha) {
    const { owner, name } = parseRepo(repo)
    tryRunGh([
      "api",
      `repos/${owner}/${name}/pulls/${prNumber}/comments`,
      "--method",
      "POST",
      "-f",
      `body=Benchmark review thread seed (${seedId})`,
      "-f",
      `commit_id=${headSha}`,
      "-f",
      `path=.bench/seed-${seedId}.md`,
      "-F",
      "line=1",
      "-f",
      "side=RIGHT",
    ])
  }

  return findPrThreadId(repo, prNumber) ?? ""
}
