import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import {
  appendJsonlLine,
  parseJsonlLines,
  readJsonlFile,
  writeJsonlFile,
} from "@profiler/store/jsonl-store.js"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  appendFile: vi.fn(),
  mkdir: vi.fn(),
}))

const mockReadFile = vi.mocked(readFile)
const mockWriteFile = vi.mocked(writeFile)
const mockAppendFile = vi.mocked(appendFile)
const mockMkdir = vi.mocked(mkdir)

beforeEach(() => {
  vi.clearAllMocks()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteFile.mockResolvedValue(undefined)
  mockAppendFile.mockResolvedValue(undefined)
})

describe("parseJsonlLines", () => {
  it("parses valid JSON lines", () => {
    const content = '{"a":1}\n{"a":2}\n'
    const result = parseJsonlLines(content, (line) => JSON.parse(line))
    expect(result).toEqual([{ a: 1 }, { a: 2 }])
  })

  it("skips empty lines", () => {
    const content = '{"a":1}\n\n\n{"a":2}\n'
    const result = parseJsonlLines(content, (line) => JSON.parse(line))
    expect(result).toEqual([{ a: 1 }, { a: 2 }])
  })

  it("returns empty array for empty string", () => {
    const result = parseJsonlLines("", (line) => JSON.parse(line))
    expect(result).toEqual([])
  })
})

describe("readJsonlFile", () => {
  it("returns parsed data from file", async () => {
    mockReadFile.mockResolvedValue('{"x":1}\n{"x":2}\n')
    const result = await readJsonlFile("/tmp/test.jsonl", (line) => JSON.parse(line))
    expect(result).toEqual([{ x: 1 }, { x: 2 }])
    expect(mockReadFile).toHaveBeenCalledWith("/tmp/test.jsonl", "utf-8")
  })

  it("returns empty array when file does not exist (ENOENT)", async () => {
    const error = new Error("File not found") as NodeJS.ErrnoException
    error.code = "ENOENT"
    mockReadFile.mockRejectedValue(error)
    const result = await readJsonlFile("/tmp/missing.jsonl", (line) => JSON.parse(line))
    expect(result).toEqual([])
  })

  it("re-throws non-ENOENT errors", async () => {
    const error = new Error("Permission denied") as NodeJS.ErrnoException
    error.code = "EACCES"
    mockReadFile.mockRejectedValue(error)
    await expect(readJsonlFile("/tmp/nope.jsonl", (line) => JSON.parse(line))).rejects.toThrow(
      "Permission denied",
    )
  })
})

describe("appendJsonlLine", () => {
  it("creates directory and appends with newline", async () => {
    await appendJsonlLine("/tmp/out/data.jsonl", { key: "value" })
    expect(mockMkdir).toHaveBeenCalledWith("/tmp/out", { recursive: true })
    expect(mockAppendFile).toHaveBeenCalledWith("/tmp/out/data.jsonl", '{"key":"value"}\n', "utf-8")
  })
})

describe("writeJsonlFile", () => {
  it("writes all items joined by newlines with trailing newline", async () => {
    await writeJsonlFile("/tmp/out/data.jsonl", [{ a: 1 }, { b: 2 }])
    expect(mockMkdir).toHaveBeenCalledWith("/tmp/out", { recursive: true })
    expect(mockWriteFile).toHaveBeenCalledWith("/tmp/out/data.jsonl", '{"a":1}\n{"b":2}\n', "utf-8")
  })
})
