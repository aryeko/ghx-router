# Mode Definitions

> Back to [main design](./README.md)

---

## Overview

Modes define how the AI agent interacts with GitHub during evaluation. Each
mode configures a different set of tools and instructions, creating controlled
conditions for comparison. The `EvalModeResolver` implements the profiler's
`ModeResolver` contract.

---

## Three Evaluation Modes

### 1. `ghx` Mode

The agent uses `ghx` (GitHub execution router) for all GitHub operations.
ghx provides structured, deterministic tool calls with normalized output.

**Configuration:**

| Setting | Value |
|---------|-------|
| PATH | Prepended with `packages/eval/bin/ghx` (or installed `ghx` binary) |
| System instructions | `SKILL.md` loaded (ghx capability reference) |
| Available tools | `ghx run <capability>` via bash |

**Agent experience:** The agent calls `ghx run pr.view --input '{...}'` and
receives structured JSON output. No parsing needed, no ambiguous flags.

### 2. `mcp` Mode

The agent uses the GitHub MCP server for GitHub operations. MCP provides
structured tool calls via the Model Context Protocol.

**Configuration:**

| Setting | Value |
|---------|-------|
| MCP server | GitHub MCP server configured in OpenCode session |
| System instructions | Generic MCP instructions (tool discovery, usage patterns) |
| Available tools | MCP tools (`github_pr_view`, `github_issue_list`, etc.) |

**Agent experience:** The agent discovers available MCP tools and calls them
directly. Output is structured but MCP-specific.

### 3. `baseline` Mode

The agent uses raw `gh` CLI and `gh api` commands for GitHub operations. This
represents the "no special tooling" baseline.

**Configuration:**

| Setting | Value |
|---------|-------|
| PATH | Standard (no ghx) |
| System instructions | "Use `gh` CLI directly for GitHub operations" |
| Available tools | `gh pr view`, `gh api graphql`, etc. via bash |

**Agent experience:** The agent must know `gh` CLI syntax, construct flags,
parse text/JSON output, and handle pagination manually.

---

## Mode Comparison Matrix

| Aspect | ghx | mcp | baseline |
|--------|-----|-----|----------|
| Tool call style | `ghx run <cap> --input '{}'` | MCP tool calls | `gh <cmd> --flag` |
| Output format | Structured JSON (normalized) | Structured JSON (MCP) | Text or JSON (varies) |
| Parsing required | No | No | Yes (agent must parse) |
| Capability discovery | SKILL.md (static) | MCP tool listing (dynamic) | Agent must know CLI |
| Error handling | Structured error codes | MCP error responses | Exit codes + stderr |
| Caching | Cache-friendly (deterministic) | Moderate | Low (free-form) |
| Token overhead | Low (structured I/O) | Moderate | High (parsing, retries) |

---

## EvalModeResolver Implementation

```typescript
class EvalModeResolver implements ModeResolver {
  async resolve(mode: string): Promise<ModeConfig> {
    switch (mode) {
      case "ghx":
        return {
          environment: {
            PATH: `${ghxBinDir}:${process.env.PATH}`,
          },
          systemInstructions: await loadSkillMd(),
          providerOverrides: {},
        }

      case "mcp":
        return {
          environment: {},
          systemInstructions: MCP_INSTRUCTIONS,
          providerOverrides: {
            mcpServers: [{
              name: "github",
              command: "npx",
              args: ["-y", "@modelcontextprotocol/server-github"],
              env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GH_TOKEN },
            }],
          },
        }

      case "baseline":
        return {
          environment: {},
          systemInstructions: BASELINE_INSTRUCTIONS,
          providerOverrides: {},
        }

      default:
        throw new Error(`Unknown mode: ${mode}`)
    }
  }
}
```

---

## System Instructions

### ghx Mode Instructions

Loaded from `SKILL.md` (the standard ghx capability reference for agents).
Contains:
- Available capabilities with input/output schemas
- Usage examples
- Error handling patterns
- Best practices for structured tool calls

### mcp Mode Instructions

```
You have access to GitHub tools via the MCP server. Use the available MCP
tools to interact with GitHub. The tools provide structured input/output.

Available tool categories:
- Pull requests: view, list, create, update, merge
- Issues: view, list, create, update
- Repositories: view, list files, get content
- Reviews: list, create, submit
- Branches: list, create, delete

Use the tool listing to discover available tools and their parameters.
```

### baseline Mode Instructions

```
Use the `gh` CLI tool directly for all GitHub operations. You have `gh`
installed and authenticated.

Common commands:
- gh pr view <number> --json <fields>
- gh pr list --json <fields>
- gh api graphql -f query='...'
- gh issue view <number> --json <fields>

Parse the output as needed. Use --json flag for structured output when
available.
```

---

## Mode Execution Order

Within a single evaluation run, modes execute sequentially:

```
For model M:
  Mode "ghx":
    +-- Start OpenCode server with ghx config
    +-- Run all scenarios x iterations
    +-- Keep server alive

  Mode "mcp":
    +-- Reconfigure OpenCode server for MCP
    +-- Run all scenarios x iterations
    +-- Keep server alive

  Mode "baseline":
    +-- Reconfigure OpenCode server for baseline
    +-- Run all scenarios x iterations
    +-- Shutdown server
```

Modes run sequentially to reuse the provider server. The server is
reconfigured between modes (environment, instructions, MCP config) but not
restarted unless reconfiguration requires it.

> **Note:** `mcp` mode requires that `mcpServers` is present in
> `providerOverrides` returned by the `ModeResolver`. The `OpenCodeProvider`
> reads `providerOverrides.mcpServers` and passes it to the OpenCode server
> configuration. If `mcpServers` is missing or empty for `mcp` mode, the
> provider will throw a configuration error at init time.
