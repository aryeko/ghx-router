import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

/**
 * Parse the non-empty lines of a JSONL string using a caller-supplied parser.
 *
 * @param content - Raw JSONL string content (lines separated by newlines).
 * @param parse - Function applied to each non-empty line to produce a typed value.
 * @returns An immutable array of parsed values in line order.
 */
export function parseJsonlLines<T>(content: string, parse: (line: string) => T): readonly T[] {
  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map(parse)
}

/**
 * Read a JSONL file and parse each line into a typed value.
 *
 * Returns an empty array when the file does not exist (ENOENT). All other
 * filesystem errors are re-thrown to the caller.
 *
 * @param filePath - Absolute path to the JSONL file to read.
 * @param parse - Function applied to each non-empty line to produce a typed value.
 * @returns An immutable array of parsed values, or an empty array if the file is missing.
 */
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

/**
 * Append a single JSON-serialized value as a new line to a JSONL file.
 *
 * Creates the parent directory if it does not exist. The file is created if it
 * does not exist and appended to if it does.
 *
 * @param filePath - Absolute path to the JSONL file.
 * @param data - The value to serialize and append.
 */
export async function appendJsonlLine(filePath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  await appendFile(filePath, `${JSON.stringify(data)}\n`, "utf-8")
}

/**
 * Write a collection of values to a JSONL file, overwriting any existing content.
 *
 * Creates the parent directory if it does not exist. Each item is serialized to a
 * separate line. The file always ends with a trailing newline.
 *
 * @param filePath - Absolute path to the JSONL file to write.
 * @param items - Values to serialize; each becomes one line in the output file.
 */
export async function writeJsonlFile(filePath: string, items: readonly unknown[]): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
  const content = items.map((item) => JSON.stringify(item)).join("\n")
  await writeFile(filePath, `${content}\n`, "utf-8")
}
