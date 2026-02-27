import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

export function parseJsonlLines<T>(content: string, parse: (line: string) => T): readonly T[] {
  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(parse)
}

export async function readJsonlFile<T>(
  filePath: string,
  parse: (line: string) => T,
): Promise<readonly T[]> {
  try {
    const content = await readFile(filePath, "utf-8")
    return parseJsonlLines(content, parse)
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      return []
    }
    throw error
  }
}

export async function appendJsonlLine(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await appendFile(filePath, `${JSON.stringify(data)}\n`, "utf-8")
}

export async function writeJsonlFile(filePath: string, items: readonly unknown[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const content = items.map((item) => JSON.stringify(item)).join("\n")
  await writeFile(filePath, `${content}\n`, "utf-8")
}
