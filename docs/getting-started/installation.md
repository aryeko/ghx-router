# Installation Guide

Get ghx running in your project or system in under five minutes.

## Requirements

Before installing, verify you have:

- **Node.js 22 or later** — Check: `node --version`
- **npm, pnpm, or yarn** — (or install globally without adding to `package.json`)
- **`gh` CLI** — [Install guide](https://cli.github.com/manual/installation)
- **`gh` authentication** — Run: `gh auth status` (should show "Logged in to GitHub.com")

## Installation Methods

### Option 1: Install in Your Project (Recommended)

Install as a project dependency:

```bash
# Using npm
npm install @ghx-dev/core

# Using pnpm (faster)
pnpm add @ghx-dev/core

# Using yarn
yarn add @ghx-dev/core
```

Then run ghx with `npx`:

```bash
npx ghx --version
npx ghx capabilities list
npx ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

### Option 2: Install Globally

Install once, use anywhere:

```bash
npm install -g @ghx-dev/core
```

Then run ghx directly:

```bash
ghx --version
ghx capabilities list
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

### Option 3: Run Without Installing (One-Off Usage)

Run directly without installation:

```bash
npx @ghx-dev/core capabilities list
npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Useful for scripts, CI/CD, or testing.

## Verify Installation

Check that ghx is ready:

```bash
# Show version
npx ghx --version

# List all capabilities
npx ghx capabilities list

# Verify gh auth
gh auth status
```

Expected output:

```text
ghx version: 0.1.1
gh authenticated: yes
```

## Environment Variables

ghx respects these optional environment variables:

| Variable | Purpose | Example |
|----------|---------|---------|
| `GITHUB_TOKEN` | GitHub API token | `ghp_...` |
| `GH_TOKEN` | Alternative GitHub token (fallback) | `ghp_...` |
| `GITHUB_GRAPHQL_URL` | Override GraphQL endpoint | `https://api.github.com/graphql` |
| `GH_HOST` | GitHub host (for enterprise) | `github.enterprise.com` |

### Setting Environment Variables

**macOS / Linux:**

```bash
# Temporary (current session only)
export GITHUB_TOKEN="your_token_here"
npx ghx run ...

# Permanent (add to ~/.bashrc, ~/.zshrc, etc.)
echo 'export GITHUB_TOKEN="your_token_here"' >> ~/.zshrc
source ~/.zshrc
```

**Windows (Command Prompt):**

```cmd
set GITHUB_TOKEN=your_token_here
npx ghx run ...
```

**Windows (PowerShell):**

```powershell
$env:GITHUB_TOKEN = "your_token_here"
npx ghx run ...
```

## Create a GitHub Token

If you don't have a token, create one:

### Classic Personal Access Token (Simple)

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a name: `ghx-dev`
4. Select scope: `repo` (or finer-grained permissions below)
5. Click "Generate token"
6. Copy the token and store it safely

For quick local testing, `repo` scope is sufficient.

### Fine-Grained Personal Access Token (Recommended)

For production or security-conscious setups:

1. Go to [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. Give it a name: `ghx-agent`
3. Set expiration (e.g., 90 days)
4. Under "Repository access", select: "All repositories" or "Only select repositories"
5. Under "Permissions", grant:
   - **Read:**
     - `Metadata` (always required)
     - `Contents`
     - `Pull requests`
     - `Issues`
     - `Actions`
     - `Projects`
   - **Write** (only if your workflow needs it):
     - `Contents` (for creating PRs, updating files)
     - `Issues` (for creating/updating issues)
     - `Pull requests` (for merging, approving)
6. Click "Generate token"
7. Copy and store safely

## Verify Authentication

Check that your `gh` CLI is authenticated:

```bash
gh auth status
```

Should show:

```text
Logged in to GitHub.com as <your-username>
- Token: ghp_... (valid, expires in 89 days)
- Git operations: https protocol
- API calls: Authorized with a OAuth token
```

If not authenticated, log in:

```bash
gh auth login
```

## Docker / CI Environments

### Docker

```dockerfile
# Use Node 22+
FROM node:22-alpine

# Install gh CLI
RUN apk add --no-cache gh

# Install ghx
RUN npm install -g @ghx-dev/core

# Authenticate gh (pass token via environment)
RUN printf "%s" "$GITHUB_TOKEN" | gh auth login --with-token

# Now ready to use ghx
RUN ghx capabilities list
```

Run with token:

```bash
docker run -e GITHUB_TOKEN="your_token_here" your-image ghx run repo.view --input '...'
```

### GitHub Actions

```yaml
name: Use ghx

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      - run: npm install -g @ghx-dev/core

      - run: ghx capabilities list
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - run: |
          ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The `GITHUB_TOKEN` is automatically available in GitHub Actions. No setup needed.

### GitLab CI

```yaml
image: node:22-alpine

before_script:
  - apk add --no-cache gh
  - npm install -g @ghx-dev/core
  - printf "%s" "$GITHUB_TOKEN" | gh auth login --with-token

test:
  script:
    - ghx capabilities list
    - ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

## Using ghx as a Library

If you're using ghx in Node.js code (not just CLI), install and import:

```bash
npm install @ghx-dev/core
```

Then in your code:

```ts
import { executeTask, createGithubClientFromToken } from "@ghx-dev/core"

const token = process.env.GITHUB_TOKEN!
const githubClient = createGithubClientFromToken(token)

const result = await executeTask(
  { task: "repo.view", input: { owner: "aryeko", name: "ghx" } },
  { githubClient, githubToken: token },
)

console.log(result.data)
```

See [First Task Tutorial](first-task.md) for more examples.

## Troubleshooting

### "Command not found: npx" or "Command not found: npm"

Node.js is not installed or not in your PATH. Install from [nodejs.org](https://nodejs.org/).

### "Command not found: gh"

The `gh` CLI is not installed. Install from [cli.github.com](https://cli.github.com/).

### "Not authenticated to GitHub"

Run `gh auth login` and follow prompts.

### "GITHUB_TOKEN is not set"

Set the token manually:

```bash
export GITHUB_TOKEN="your_token_here"
npx ghx run ...
```

Or pass it directly to your Node.js code (see library usage above).

### "Permission denied: SKILL.md" (when using `ghx setup`)

The `.agents/skills/ghx/` directory doesn't have write permissions. Either:

1. Create the directory manually: `mkdir -p ~/.agents/skills/ghx/`
2. Or use `--scope project` instead of `--scope user` to write to your repo

### "npm ERR! code ERESOLVE"

Dependency conflict. Try:

```bash
npm install @ghx-dev/core --legacy-peer-deps
```

## Next Steps

- **[Getting Started](README.md)** — Start with your first capability
- **[First Task Tutorial](first-task.md)** — Run a real workflow using ghx
- **[Agent Setup Guide](setup-for-agents.md)** — Install ghx skill for coding agents

---

**Still stuck?** Open an issue on [GitHub](https://github.com/aryeko/ghx/issues) with your
environment and error message.
