# Installation

Install `@ghx-dev/eval` and verify the setup within the ghx monorepo.

## Prerequisites

- **Node.js 22+** -- the package uses modern ES module features that require Node 22 or later
- **pnpm** -- workspace-aware package manager used by the ghx monorepo
- **Access to the ghx monorepo** -- `@ghx-dev/eval` is a private package and is not published to npm

## Install

```bash
# Clone the repository (if not already done)
git clone <repo-url>
cd ghx

# Install all dependencies
pnpm install
```

This installs all workspace packages, including `@ghx-dev/eval` and its dependency `@ghx-dev/agent-profiler`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` or `GH_TOKEN` | Yes | GitHub API access for fixture management and checkpoint verification |
| `GHX_SKILL_MD` | No | Path to SKILL.md for ghx mode (auto-detected if ghx is installed) |
| `GHX_SKILL_FALLBACK` | No | Fallback SKILL.md content if file not found |

## Verify Setup

Run the test suite to confirm everything is wired correctly:

```bash
pnpm --filter @ghx-dev/eval run test
```

All tests should pass. If fixture-related tests fail, ensure `GITHUB_TOKEN` is set and has access to the benchmark repository.

## Source Reference

Package definition: `packages/eval/package.json`

## Related Documentation

- [Quick Start](quick-start.md) -- run your first evaluation from config to report
- [Core Concepts](concepts.md) -- eval vs profiler, modes, fixtures, and checkpoints
- [Development Setup](../contributing/development-setup.md) -- contributor workflow and tooling
