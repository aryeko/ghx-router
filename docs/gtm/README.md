# GTM Draft Pack: Installed-User Adoption

## Purpose
This workspace prepares publish-ready growth materials for `ghx` without touching benchmark implementation work. All benchmark metrics are imported later from finalized benchmark artifacts.

## Plan Index
See the high-level phase/status tracker in [INDEX.md](./INDEX.md).

## Latest Medium Draft
- [Medium Draft 03: Deep Technical](./medium-post-03-deep-technical.md)

## Positioning One-Liner
`ghx` gives agents a stable, typed GitHub capability interface so they can execute real repo workflows without re-discovering CLI and API surface area each run.

## Message Pillars
1. Reliability: stable result envelope and deterministic routing reduce brittle automation behavior.
2. Speed to first value: two commands get users to a real capability run quickly.
3. Practical workflows: PR, issues, workflows, and project tasks in one consistent interface.

## Why Now
Agent workflows are increasingly expected to perform real GitHub operations. Most teams still rely on ad hoc command chains that are noisy, fragile, and hard to scale.

## Who This Is For
1. Solo AI-agent power users automating PR and issue workflows.
2. Developer tooling engineers building repeatable GitHub automation paths.
3. OSS maintainers who want predictable execution behavior from agents.

## When Not To Use ghx
1. You only need one-off manual GitHub actions and do not run repeatable agent workflows.
2. You require provider-specific behavior that intentionally bypasses shared capability contracts.
3. You are not ready to maintain token/auth permissions for automated GitHub operations.

## Locked CTA Pair
1. `npx @ghx-dev/core capabilities list`
2. `npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'`

## Benchmark Isolation Rule
Benchmark work remains isolated on branch `plan/benchmark-scenarios-ghx-fixtures` in `/Users/aryekogan/repos/ghx/.worktrees/ghx-benchmark-worktree`.
