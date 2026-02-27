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
  metadata: z.record(z.string(), z.unknown()),
})

/**
 * Write a RunManifest to disk as pretty-printed JSON.
 *
 * Creates the parent directory if it does not exist. Overwrites any existing file at the path.
 *
 * @param path - Absolute path where the manifest file will be written.
 * @param manifest - The manifest data to serialize.
 */
export async function writeManifest(path: string, manifest: RunManifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8")
}

/**
 * Read and validate a RunManifest from disk.
 *
 * Throws a Zod validation error if the file content does not conform to the
 * expected manifest schema. Throws a filesystem error if the file does not exist.
 *
 * @param path - Absolute path to the manifest JSON file.
 * @returns The validated RunManifest.
 */
export async function readManifest(path: string): Promise<RunManifest> {
  const content = await readFile(path, "utf-8")
  const parsed = RunManifestSchema.parse(JSON.parse(content))
  return parsed as RunManifest
}

/**
 * Read, partially update, and re-write a RunManifest.
 *
 * Merges `updates` into the existing manifest using an immutable spread, then
 * persists the result back to the same path via a non-atomic read-modify-write.
 *
 * @remarks Not concurrency-safe — assumes single-process usage.
 *
 * @param path - Absolute path to the manifest JSON file.
 * @param updates - Partial manifest fields to overwrite.
 * @returns The updated RunManifest after writing.
 */
export async function updateManifest(
  path: string,
  updates: Partial<RunManifest>,
): Promise<RunManifest> {
  const existing = await readManifest(path)
  const updated: RunManifest = { ...existing, ...updates }
  await writeManifest(path, updated)
  return updated
}
