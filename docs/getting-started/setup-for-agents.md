# Agent Setup Guide: Installing ghx for Coding Agents

Make ghx discoverable to AI coding agents (Claude Code, Cursor, OpenCode, etc.) by installing a
skill file. Then agents automatically know how to use 69 GitHub capabilities without manual
prompting.

## Why Agent Setup?

**The Problem:** Without guidance, agents waste significant tokens researching GitHub CLI flags,
parsing unstructured output, and recovering from hallucinated commands.

**The Solution:** `ghx setup` installs a single Markdown "skill" file that teaches agents:

- What ghx is and why to use it
- How to discover capabilities (`ghx capabilities list`)
- How to understand a capability's contract (`ghx capabilities explain <id>`)
- How to execute operations and interpret results
- How to handle retries and errors

With the skill installed, agents pick it up automatically in their next session.

## What Gets Installed

The `ghx setup` command writes a single file: `SKILL.md`

This Markdown document includes:

- A purpose statement for ghx capability execution
- Session bootstrap steps (verify `gh` auth, list capabilities)
- Workflow guidance (explain before run, error handling)
- Result-envelope handling rules and retry logic
- Example invocations using public repositories

**No binaries, no config mutations, no environment side effects** — just one Markdown file.

## Installation: Quick Start

### For Your Project (Recommended)

Install ghx skill in your repository so all team members and CI agents get it:

```bash
npx ghx setup --scope project --yes
```

This writes: `.agents/skills/ghx/SKILL.md`

Commit it to version control:

```bash
git add .agents/skills/ghx/SKILL.md
git commit -m "add ghx agent skill"
```

Team members now have ghx available in their next agent session.

### For Your Personal Machine

Install once so all projects on your machine can use ghx:

```bash
npx ghx setup --scope user --yes
```

This writes: `~/.agents/skills/ghx/SKILL.md`

Now every coding agent session on your machine has access to ghx.

## Full Command Reference

```bash
npx ghx setup --scope <user|project> [--yes] [--dry-run] [--verify] [--track]
```

### Flags

| Flag | Required | Description |
|------|----------|-------------|
| `--scope <user\|project>` | Yes | Where to install the skill |
| `--yes` | No | Skip overwrite confirmation (default: prompt) |
| `--dry-run` | No | Show target path without writing |
| `--verify` | No | Check that skill is installed and valid |
| `--track` | No | Append setup event to local telemetry log |

### Examples

```bash
# Install to project scope, auto-confirm
npx ghx setup --scope project --yes

# Install to user scope, prompt if file exists
npx ghx setup --scope user

# Preview where it would install (don't write)
npx ghx setup --scope project --dry-run

# Verify an existing installation
npx ghx setup --scope project --verify

# Install and log setup event locally
npx ghx setup --scope user --track --yes
```

## Installation Locations

ghx supports two scopes:

### Project Scope (`.agents/skills/ghx/SKILL.md`)

**When to use:** Team repositories, CI/CD pipelines, shared projects

**Advantages:**

- Shared via version control
- Visible to all team members and bots
- Versioned with your repository

**Example:**

```bash
cd /path/to/your/repo
npx ghx setup --scope project --yes
git add .agents/skills/ghx/SKILL.md
git commit -m "add ghx agent skill"
```

### User Scope (`~/.agents/skills/ghx/SKILL.md`)

**When to use:** Personal machine, local development

**Advantages:**

- One-time install; all projects benefit
- No repository changes needed
- Useful for local agent testing

**Example:**

```bash
npx ghx setup --scope user --yes
# Now all agents on this machine have ghx available
```

## How Agents Use the Skill

Once the skill is installed, the agent workflow looks like:

1. **Discovery** — Agent sees `.agents/skills/ghx/SKILL.md` in its context
2. **Parsing** — Agent reads the skill and understands ghx's purpose
3. **Bootstrap** — Agent runs `gh auth status` and `ghx capabilities list` to verify setup
4. **Execution** — Agent calls capabilities as needed, handling results per the skill guidance
5. **Iteration** — Agent learns from results and adapts

Example agent session:

```text
Agent: I see there's a ghx skill in this repository. Let me bootstrap ghx.
Agent: $ gh auth status
System: Logged in to github.com as octocat (...)
Agent: $ ghx capabilities list
System: Repository (3), Issues (18), Pull Requests (21), ...
Agent: Great! Now I can create an issue programmatically.
Agent: $ ghx run issue.create --input '{"owner":"...","repo":"...","title":"..."}'
System: {"ok":true,"data":{...},...}
Agent: Perfect, issue #42 created. Continuing with the workflow...
```

## Typical Workflows

### Personal Machine Setup

Make ghx available to all your local agent sessions:

```bash
npm install -g @ghx-dev/core
ghx setup --scope user --yes
```

Every agent on your machine now has ghx.

### Project Onboarding

Enable ghx for your team:

```bash
# In your repository
npx ghx setup --scope project --yes
git add .agents/skills/ghx/SKILL.md
git commit -m "add ghx agent skill"
git push
```

Team members pull the change. Next time they run an agent session, ghx is available.

### CI/CD Verification

Assert the skill is installed before running agent-based workflows:

```yaml
# .github/workflows/agent-workflow.yml
- run: npx ghx setup --scope project --verify
- run: npx @opencode-ai/cli run "my-agent-task"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Skill Content Overview

The installed `SKILL.md` includes:

### Purpose Section

```markdown
# ghx: GitHub Execution Router

Execute typed GitHub capabilities with deterministic routing and stable result envelopes.

69 capabilities across 7 domains: Issues, Pull Requests, Workflows, Releases, etc.

- No wasted tokens on discovery
- Schema-validated input/output
- Consistent error handling
```

### Bootstrap Section

Instructions for verifying setup:

```bash
gh auth status           # Verify gh CLI is authenticated
ghx capabilities list    # Discover all 69 capabilities
```

### Workflow Section

How to use capabilities:

```bash
# Always explain first
ghx capabilities explain issue.create

# Then run with validated input
ghx run issue.create --input '{
  "owner":"...", "repo":"...", "title":"..."
}'
```

### Error Handling Section

How to interpret results:

```json
{
  "ok": true,
  "data": { /* capability-specific output */ },
  "error": null,
  "meta": { "capability_id": "issue.create", "route_used": "cli" }
}
```

Error codes and retry guidance for each type.

### Example Section

Neutral examples using public repositories:

```bash
# View a public repository
ghx run repo.view --input '{"owner":"aryeko","name":"ghx"}'

# List issues on a public repository
ghx run issue.list --input '{"owner":"aryeko","name":"ghx","states":["open"]}'
```

## Verification

Check that a skill is installed correctly:

```bash
# Verify project scope
npx ghx setup --scope project --verify

# Verify user scope
npx ghx setup --scope user --verify
```

Expected output:

```text
✓ Skill file verified at ~/.agents/skills/ghx/SKILL.md
✓ Content contains expected sections
✓ File is readable by agents
```

## Safety Model

ghx setup is designed with safety in mind:

### No Silent Overwrites

If `SKILL.md` already exists and `--yes` is not set:

```bash
npx ghx setup --scope project
```

Interactive terminals get a prompt:

```text
File exists: .agents/skills/ghx/SKILL.md
Overwrite? [y/N]:
```

Non-interactive environments (CI, pipes) fail with an error message instead of silently
overwriting.

### Dry-Run Safety

Preview without writing:

```bash
npx ghx setup --scope project --dry-run
# Output: Target path: .agents/skills/ghx/SKILL.md
# (No file written)
```

### Verify-Only Safety

Check existing installation without writing:

```bash
npx ghx setup --scope project --verify
# (No file written, only checked)
```

### Opt-In Telemetry

The `--track` flag is required for local telemetry:

```bash
npx ghx setup --scope user --track --yes
```

Appends event to `~/.agents/ghx/setup-events.jsonl` (local-only, never sent anywhere).

Without `--track`, no telemetry is collected.

## Common Questions

### Can I install both project and user scope?

Yes. Run the command twice:

```bash
# Once for project
npx ghx setup --scope project --yes

# Once for user
npx ghx setup --scope user --yes
```

Both files coexist. The project scope takes precedence in that repository.

### What if the skill file goes out of date?

When you upgrade ghx, reinstall the skill:

```bash
npm update @ghx-dev/core
npx ghx setup --scope project --yes
```

The command overwrites with the latest skill content matching your version.

### Can agents uninstall ghx?

The skill is just a Markdown file. Agents (or you) can delete it:

```bash
rm ~/.agents/skills/ghx/SKILL.md
# or
rm .agents/skills/ghx/SKILL.md
```

No cleanup needed. To reinstall, run `ghx setup` again.

### Do I need a GitHub token for `ghx setup`?

No. The `setup` command only writes a Markdown file. It doesn't authenticate or call GitHub
APIs. You need a token when agents actually *run* capabilities.

### What agent systems support ghx skills?

Any system that:

1. Respects the `.agents/skills/` directory structure
2. Can read Markdown files as skill definitions

Known compatible systems:

- **Claude Code** (claude.ai/code)
- **Cursor AI**
- **OpenCode SDK** / OpenCode agent runner
- **Custom agents** that implement the `.agents/` skill discovery

## Troubleshooting Setup

### "Directory does not exist" (user scope)

The `~/.agents/` directory doesn't exist. Create it:

```bash
mkdir -p ~/.agents/skills/ghx/
npx ghx setup --scope user --yes
```

Or just run the command — it creates the directory automatically.

### "Permission denied" (user scope)

Your home directory doesn't allow writing. Check permissions:

```bash
ls -la ~/ | grep agents
chmod u+w ~/.agents/
```

### "Permission denied" (project scope)

Your repository directory isn't writable. Check:

```bash
ls -la .agents/ 2>/dev/null || mkdir -p .agents/skills/ghx/
```

### "File already exists" (not using `--yes`)

The skill file exists. To overwrite interactively:

```bash
npx ghx setup --scope project
# When prompted: y (yes, overwrite)
```

Or use `--yes` to skip the prompt:

```bash
npx ghx setup --scope project --yes
```

### Verify fails

Check that the file exists and is readable:

```bash
cat .agents/skills/ghx/SKILL.md | head -10
```

If it's missing, reinstall:

```bash
npx ghx setup --scope project --yes
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: Setup ghx

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

      - run: ghx setup --scope project --verify

      # Now run your agent-based workflow
      - run: |
          npx @opencode-ai/cli run "my-task"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### GitLab CI

```yaml
image: node:22-alpine

stages:
  - setup
  - run

setup_ghx:
  stage: setup
  script:
    - npm install -g @ghx-dev/core
    - ghx setup --scope project --yes
    - git add .agents/skills/ghx/SKILL.md
    - git commit -m "install ghx skill" || true

run_agent:
  stage: run
  script:
    - ghx setup --scope project --verify
    - npx @opencode-ai/cli run "my-task"
  env:
    GITHUB_TOKEN: $CI_JOB_TOKEN
```

## Next Steps

- **[Getting Started](README.md)** — Run your first capability
- **[First Task Tutorial](first-task.md)** — Build a complete workflow
- **[How ghx Works](how-it-works.md)** — Understand architecture and routing

## Related Documentation

- **[Architecture](../architecture/README.md)** — System design and routing engine
- **[Library API](../guides/library-api.md)** — Runtime tools agents can use (`createExecuteTool`, `listCapabilities`, `explainCapability`)

---

**Questions?** Open an issue on [GitHub](https://github.com/aryeko/ghx/issues) or check the
[FAQ](../contributing/README.md#faq).
