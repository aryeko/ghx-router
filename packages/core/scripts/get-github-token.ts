import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export type GithubTokenResolverOptions = {
  env?: NodeJS.ProcessEnv
  getToken?: () => Promise<string>
}

export async function getTokenFromGhCli(): Promise<string> {
  const { stdout } = await execFileAsync("gh", ["auth", "token"], {
    encoding: "utf8",
  })

  return String(stdout).trim()
}

export async function resolveGithubToken(
  options: GithubTokenResolverOptions = {},
): Promise<string> {
  const env = options.env ?? process.env
  const envToken = env.GITHUB_TOKEN?.trim()
  if (envToken) {
    return envToken
  }

  const getToken = options.getToken ?? getTokenFromGhCli
  const token = (await getToken()).trim()
  if (token.length === 0) {
    throw new Error("GitHub token not available")
  }

  return token
}
