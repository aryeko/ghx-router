import { spawnSync } from "node:child_process"

export function runGh(args: string[]): string {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
  })

  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim()
    throw new Error(stderr.length > 0 ? stderr : `gh command failed: gh ${args.join(" ")}`)
  }

  return (result.stdout ?? "").trim()
}

export function tryRunGh(args: string[]): string | null {
  try {
    return runGh(args)
  } catch {
    return null
  }
}

export function runGhJson<T = unknown>(args: string[]): T {
  const output = runGh(args)
  if (output.length === 0) {
    return {} as T
  }

  return JSON.parse(output) as T
}

export function tryRunGhJson<T = unknown>(args: string[]): T | null {
  const output = tryRunGh(args)
  if (output === null) {
    return null
  }

  if (output.length === 0) {
    return {} as T
  }

  return JSON.parse(output) as T
}

export function runGhWithToken(args: string[], token: string): string {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    env: { ...process.env, GH_TOKEN: token },
  })

  if (result.status !== 0) {
    const stderr = (result.stderr ?? "").trim()
    throw new Error(stderr.length > 0 ? stderr : `gh command failed: gh ${args.join(" ")}`)
  }

  return (result.stdout ?? "").trim()
}

export function tryRunGhWithToken(args: string[], token: string): string | null {
  try {
    return runGhWithToken(args, token)
  } catch {
    return null
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
