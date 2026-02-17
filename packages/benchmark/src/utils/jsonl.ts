import { readFile } from "node:fs/promises"
import type { ZodType } from "zod"

/**
 * Parses JSONL content string into an array of objects.
 * Optionally validates each row against a Zod schema.
 */
export function parseJsonlLines<T = unknown>(content: string, schema?: ZodType<T>): T[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const parsed: unknown = JSON.parse(line)
      if (schema) {
        return schema.parse(parsed)
      }
      return parsed as T
    })
}

/**
 * Reads a JSONL file and parses each line.
 * Optionally validates each row against a Zod schema.
 */
export async function readJsonlFile<T = unknown>(
  filePath: string,
  schema?: ZodType<T>,
): Promise<T[]> {
  const content = await readFile(filePath, "utf8")
  return parseJsonlLines(content, schema)
}
