import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { readJsonlFile } from "../util/jsonl.js"

export type SessionAnalysis = {
  toolCallCount: number
  toolCallCommands: string[]
  assistantTurns: number
  reasoningBlocks: number
  tokens: {
    input: number
    output: number
    reasoning: number
    cache_read: number
    cache_write: number
    total: number
  } | null
}

export type GhxLogAnalysis = {
  capabilities: Array<{ capability_id: string; route: string | null; ok: boolean }>
  errorCount: number
}

export type IterData = {
  iterDir: string
  mode: string
  scenarioId: string
  iteration: number
  session: SessionAnalysis | null
  ghxLogs: GhxLogAnalysis | null
}

type SessionEntry = {
  type: string
  state?: {
    input?: {
      command?: string
    }
  }
  tokens?: {
    total?: number
    input?: number
    output?: number
    reasoning?: number
    cache_read?: number
    cache_write?: number
    cache?: {
      read?: number
      write?: number
    }
  }
}

type SessionDocument = {
  info?: unknown
  messages?: Array<{
    info?: unknown
    parts?: SessionEntry[]
  }>
}

type GhxLogEntry = {
  msg: string
  capability_id?: string
  route?: string
  ok?: boolean
}

async function readSessionEntries(sessionPath: string): Promise<SessionEntry[]> {
  const content = await readFile(sessionPath, "utf8")

  // Try new format: single pretty-printed JSON document with messages[].parts[]
  let doc: unknown
  try {
    doc = JSON.parse(content)
  } catch {
    // Not valid JSON as a whole — fall through to JSONL parsing
  }

  if (doc !== undefined && typeof doc === "object" && doc !== null && "messages" in doc) {
    const sessionDoc = doc as SessionDocument
    return (sessionDoc.messages ?? []).flatMap((msg) => msg.parts ?? [])
  }

  // Fallback: classic JSONL (one object per line)
  return readJsonlFile<SessionEntry>(sessionPath)
}

export async function analyzeSession(iterDir: string): Promise<SessionAnalysis | null> {
  const sessionPath = join(iterDir, "session.jsonl")
  let entries: SessionEntry[]
  try {
    entries = await readSessionEntries(sessionPath)
  } catch {
    return null
  }

  const toolCallCommands: string[] = []
  let assistantTurns = 0
  let reasoningBlocks = 0
  const tokenAccum = { input: 0, output: 0, reasoning: 0, cache_read: 0, cache_write: 0, total: 0 }
  let hasTokens = false

  for (const entry of entries) {
    if (entry.type === "tool") {
      const command = entry.state?.input?.command
      if (command !== undefined) {
        toolCallCommands.push(command)
      } else {
        toolCallCommands.push("")
      }
    } else if (entry.type === "text") {
      assistantTurns += 1
    } else if (entry.type === "reasoning") {
      reasoningBlocks += 1
    } else if (entry.type === "step-finish" && entry.tokens) {
      hasTokens = true
      tokenAccum.input += entry.tokens.input ?? 0
      tokenAccum.output += entry.tokens.output ?? 0
      tokenAccum.reasoning += entry.tokens.reasoning ?? 0
      tokenAccum.cache_read += entry.tokens.cache_read ?? entry.tokens.cache?.read ?? 0
      tokenAccum.cache_write += entry.tokens.cache_write ?? entry.tokens.cache?.write ?? 0
      tokenAccum.total += entry.tokens.total ?? 0
    }
  }

  const tokens = hasTokens ? { ...tokenAccum } : null

  return {
    toolCallCount: toolCallCommands.length,
    toolCallCommands,
    assistantTurns,
    reasoningBlocks,
    tokens,
  }
}

export async function analyzeGhxLogs(iterDir: string): Promise<GhxLogAnalysis | null> {
  let files: string[]
  try {
    files = await readdir(iterDir)
  } catch {
    return null
  }

  const ghxFiles = files.filter((f) => f.startsWith("ghx-") && f.endsWith(".jsonl"))
  if (ghxFiles.length === 0) {
    return null
  }

  const routeMap = new Map<string, string | null>()
  const completions: Array<{ capability_id: string; ok: boolean }> = []
  let errorCount = 0

  for (const file of ghxFiles) {
    let entries: GhxLogEntry[]
    try {
      entries = await readJsonlFile<GhxLogEntry>(join(iterDir, file))
    } catch {
      continue
    }

    for (const entry of entries) {
      if (entry.msg === "route.plan" && entry.capability_id !== undefined) {
        routeMap.set(entry.capability_id, entry.route ?? null)
      } else if (entry.msg === "execute.complete" && entry.capability_id !== undefined) {
        const ok = entry.ok ?? false
        completions.push({ capability_id: entry.capability_id, ok })
        if (!ok) {
          errorCount += 1
        }
      }
    }
  }

  const capabilities = completions.map(({ capability_id, ok }) => ({
    capability_id,
    route: routeMap.get(capability_id) ?? null,
    ok,
  }))

  return { capabilities, errorCount }
}

export async function readRunDir(runDir: string): Promise<IterData[]> {
  let modes: string[]
  try {
    modes = await readdir(runDir)
  } catch {
    return []
  }

  const result: IterData[] = []

  for (const mode of modes) {
    const modeDir = join(runDir, mode)
    let scenarios: string[]
    try {
      scenarios = await readdir(modeDir)
    } catch {
      continue
    }

    for (const scenarioId of scenarios) {
      const scenarioDir = join(modeDir, scenarioId)
      let iters: string[]
      try {
        iters = await readdir(scenarioDir)
      } catch {
        continue
      }

      for (const iterName of iters) {
        const match = iterName.match(/^iter-(\d+)$/)
        if (!match || !match[1]) continue

        const iteration = Number(match[1])
        const iterDir = join(scenarioDir, iterName)

        const [session, ghxLogs] = await Promise.all([
          analyzeSession(iterDir),
          analyzeGhxLogs(iterDir),
        ])

        result.push({ iterDir, mode, scenarioId, iteration, session, ghxLogs })
      }
    }
  }

  return result
}
