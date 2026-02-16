# GTM Plan Index and Status

## Purpose
This is the single high-level index for the GTM adoption plan. It links to all detailed artifacts and tracks current execution status.

## Current Status
- Overall phase: `Draft Pack Complete, Benchmark-Gated Launch Pending`
- GTM worktree: `/Users/aryekogan/repos/ghx/.worktrees/gtm-draft-pack` on `codex/gtm-draft-pack`
- Benchmark worktree: `/Users/aryekogan/repos/ghx/.worktrees/ghx-benchmark-worktree` on `plan/benchmark-scenarios-ghx-fixtures`
- Launch blocker: finalized benchmark snapshot import (single-source metric injection)

## High-Level Phases
| Phase | Status | Exit Criteria | Details |
| --- | --- | --- | --- |
| 1. Messaging and Contracts | Complete | Positioning, claim policy, snapshot schema, placeholder spec written | [README](./README.md), [Claim Contract](./claim-contract.md), [Benchmark Snapshot Schema](./benchmark-snapshot-schema.md), [Placeholder Spec](./content-placeholder-spec.md) |
| 2. Draft Content Production | Complete | Medium + LinkedIn + X drafts created with placeholders and CTA pair | [Medium 01](./medium-post-01-token-tax.md), [Medium 02](./medium-post-02-benchmark-method.md), [LinkedIn Bank](./linkedin-post-bank-01.md), [X Bank](./x-post-bank-01.md), [X Launch Thread](./x-launch-thread.md) |
| 3. Integration PR Planning | Complete | Target matrix + first-wave PR packets created | [Target Matrix](./integrations/target-matrix.md), [LangGraph](./integrations/langgraph-pr-plan.md), [AutoGen](./integrations/autogen-pr-plan.md), [CrewAI](./integrations/crewai-pr-plan.md), [PydanticAI](./integrations/pydanticai-pr-plan.md), [smolagents](./integrations/smolagents-pr-plan.md) |
| 4. Launch Operations Prep | Complete | Checklist and 60-minute runbook ready | [Launch Checklist](./launch-checklist.md), [Launch Runbook](./launch-runbook-60min.md) |
| 5. Metrics and Adoption Tracking | Complete | KPI and weekly dashboard plan documented | [Metrics Tracking Plan](./metrics-tracking-plan.md) |
| 6. Benchmark Snapshot Injection | Pending | Finalized snapshot imported, placeholders replaced, consistency checks pass | [Launch Checklist](./launch-checklist.md), [Benchmark Snapshot Schema](./benchmark-snapshot-schema.md) |
| 7. Public Launch Execution | Pending | Medium + LinkedIn + X + integration PR wave executed in sequence | [Launch Runbook](./launch-runbook-60min.md), [Launch Checklist](./launch-checklist.md) |

## Benchmark-Gated Rules (Locked)
1. Do not modify benchmark implementation from this worktree.
2. Do not publish any external content before snapshot sign-off.
3. Do not use hard numeric claims until placeholders are replaced from finalized snapshot data.
4. Use one snapshot source for all channels.

## Immediate Next Actions
1. Complete benchmark verification in benchmark worktree.
2. Produce finalized snapshot artifact in benchmark reports.
3. Import snapshot values into GTM placeholders.
4. Run claim consistency review.
5. Execute launch sequence.

## Change Control
Update this index when:
1. A phase status changes.
2. A new GTM artifact is added.
3. Launch blocker changes.
