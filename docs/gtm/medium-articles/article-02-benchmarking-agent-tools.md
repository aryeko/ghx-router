# How We Benchmark Agent Developer Tools (And Why Most Claims Fall Apart)

*A reproducible methodology for measuring what actually matters: tokens, latency, tool calls, and reliability.*

---

**Reading time:** ~8 minutes
**Audience:** AI agent builders, developer tooling evaluators, engineering leads
**Subtitle for Medium:** *Performance claims without controlled methodology are just marketing. Here's how to do it right.*

---

## The Problem with Agent Tool Benchmarks

You have seen the claims. "10x faster." "80% fewer tokens." "Dramatically more reliable."

But when you dig into the methodology, you find:

- Anecdotal comparisons with no controlled baseline
- Cherry-picked scenarios that favor the tool being promoted
- No fixture isolation, so repo state drifts between runs
- Aggregate-only reporting that hides per-scenario failures
- No model attribution — results from GPT-4 are silently compared against Claude outputs

**If you cannot reproduce it, it is not a benchmark. It is a testimonial.**

When we built [ghx](https://github.com/aryeko/ghx) — a typed capability router for GitHub agent workflows — we needed to prove it actually worked. Not to ourselves. To anyone who runs the same scenarios.

This article breaks down the methodology we use, why each constraint exists, and how you can apply the same rigor to evaluate any agent tooling.

---

## The Benchmark Design

### Two Modes, Same Intent

Every benchmark scenario runs through two modes:

| Mode | What It Does |
|------|-------------|
| **`agent_direct`** | The agent uses `gh` CLI and standard tools directly — the current default for most teams |
| **`ghx`** | The agent calls typed capabilities through the ghx execution router |

Both modes execute the **same scenario intent** — "check PR status," "analyze CI failures," "merge a pull request." The difference is the execution path, not the goal.

### Fixture Isolation

Each benchmark run uses **shared fixture manifests**. The repository state is seeded and validated before any scenario executes. This eliminates a common source of phantom regressions: a repo that changed between runs, making the second run look faster or slower for reasons that have nothing to do with the tool.

### Row-Level Validation

Every individual scenario execution (not just the aggregate) must pass:

- **Success**: Did the operation complete?
- **Output validity**: Does the result contain the expected data?
- **No runner failures**: Did the harness itself work correctly?
- **No timeouts or stalls**: Did the execution complete within bounds?

If a single row fails validation, it is flagged — not silently averaged into "95% success."

### Model Attribution

Every benchmark result includes the model ID and provider. You cannot compare results across models. Our current benchmarks use `gpt-5.1-codex-mini` for both modes, on the same machine, with the same environment.

---

## What We Measure

Four efficiency metrics and five reliability metrics:

### Efficiency Metrics

| Metric | Why It Matters |
|--------|---------------|
| **Active token reduction** | Directly impacts inference cost |
| **Latency reduction** | Impacts end-to-end workflow speed |
| **Tool call reduction** | Fewer round trips = fewer failure points |
| **Scenario win rate** | Per-scenario comparison, not just aggregates |

### Reliability Metrics

| Metric | Why It Matters |
|--------|---------------|
| **Success rate** | Core correctness |
| **Output validity rate** | Structured output meets schema expectations |
| **Runner failure rate** | Harness health (not tool quality) |
| **Timeout/stall rate** | Execution completes within bounds |
| **Retry rate** | Signal of unstable execution paths |

---

## The Gate System

Raw numbers without thresholds are ambiguous. We use a **dual-gate model** with two profiles:

### `verify_pr` Gate (Standard)

Used for PR-level verification. Thresholds are calibrated to catch regressions without blocking minor fluctuations:

- Active token reduction >= 10%
- Latency reduction >= 10%
- Tool call reduction >= 15%
- Success rate non-inferior (delta >= -6%)
- Output validity >= 95%
- Runner failure rate <= 7%

### `verify_release` Gate (Strict)

Used before publishing claims. Tighter thresholds:

- Active token reduction >= 22%
- Latency reduction >= 20%
- Tool call reduction >= 25%

If a gate fails, we diagnose — we do not lower the threshold.

---

## Current Results

With this methodology, here is what the latest benchmarks show:

| Metric | agent_direct | ghx | Delta |
|--------|-------------|-----|-------|
| Median latency | 57,868 ms | 5,860 ms | **-90%** |
| Median active tokens | 2,851 | 1,075 | **-62%** |
| Median tool calls | 8 | 2 | **-75%** |
| Success rate | 100% | 100% | **0** |
| Output validity | 100% | 100% | **0** |

*Model: `gpt-5.1-codex-mini`. Profile: `verify_pr`. All gate checks passed.*

The latency reduction is dramatic because ghx eliminates the discovery loop — the agent does not spend tokens and time figuring out *how* to do the task before actually doing it.

The tool call reduction (8 to 2) reflects the same principle: deterministic routing means fewer exploratory calls.

---

## How to Apply This to Your Own Tools

You do not need ghx to use this methodology. The principles apply to any agent tooling evaluation:

### 1. Define scenario intent, not just commands

Do not benchmark "run this exact command." Benchmark "check PR CI status" and let each mode use its natural execution path.

### 2. Isolate fixtures

Seed your test repository to a known state before each run. If repo state drifts, your benchmark is measuring drift, not tooling.

### 3. Validate per-row, not per-aggregate

A 95% success rate can mean "1 in 20 scenarios silently fails." Check every row.

### 4. Lock the model

Never compare results across different models or providers. Even the same model at different temperatures or token limits produces different behavior.

### 5. Use explicit gate profiles

Set thresholds before you run the benchmark, not after you see the results. If you set thresholds after, you are curve-fitting.

### 6. Publish your methodology

If you cannot show someone else how to reproduce your numbers, you do not have a benchmark.

---

## Open-Source Benchmark Harness

The ghx benchmark harness is available in the repository at `packages/benchmark`. It supports:

- Scenario set definitions with fixture manifests
- Paired-mode execution (baseline vs. tool)
- Per-row validation and artifact collection
- Automatic gate evaluation with configurable profiles
- Summary report generation

While the harness is currently internal to ghx, the methodology patterns are applicable to any agent tool evaluation pipeline.

---

## Try ghx

If the benchmark numbers interest you, try the tool:

```bash
npx @ghx-dev/core capabilities list
npx @ghx-dev/core run repo.view --input '{"owner":"aryeko","name":"ghx"}'
```

Star the repo: [github.com/aryeko/ghx](https://github.com/aryeko/ghx)

---

*[Arye Kogan](https://github.com/aryeko) builds developer infrastructure for AI agent workflows. ghx is MIT licensed and open source.*

---

## Article Tags (for Medium)

`benchmarking`, `ai-agents`, `developer-tools`, `methodology`, `performance`, `open-source`
