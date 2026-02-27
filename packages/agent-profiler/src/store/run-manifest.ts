import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { z } from "zod"
import type { RunManifest } from "./types.js"

const RunManifestSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  modes: z.array(z.string()),
  scenarioIds: z.array(z.string()),
  repetitions: z.number(),
  totalRows: z.number(),
  outputJsonlPath: z.string(),
  reportsDir: z.string().optional(),
  metadata: z.record(z.unknown()),
})

export async function writeManifest(path: string, manifest: RunManifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8")
}

export async function readManifest(path: string): Promise<RunManifest> {
  const content = await readFile(path, "utf-8")
  const parsed = RunManifestSchema.parse(JSON.parse(content))
  return parsed as RunManifest
}

export async function updateManifest(
  path: string,
  updates: Partial<RunManifest>,
): Promise<RunManifest> {
  const existing = await readManifest(path)
  const updated: RunManifest = { ...existing, ...updates }
  await writeManifest(path, updated)
  return updated
}
