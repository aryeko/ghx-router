# Report Structure

> Back to [main design](./README.md)

---

## Overview

Reports are generated as a folder of interconnected files -- Markdown for
human-readable pages, CSV and JSON for data export. Each profiling run
produces a timestamped report folder.

---

## Folder Layout

```
reports/
  2026-02-27T12-00-00/
    index.md                    # High-level summary (the "landing page")
    metrics.md                  # Detailed metrics breakdown
    analysis.md                 # Session analysis findings
    comparison.md               # Cross-mode and cross-model comparison
    scenarios/
      scenario-a.md             # Per-scenario deep dive
      scenario-b.md
    data/
      results.json              # Full ProfileRow[] array
      results.csv               # Flat CSV with all metrics
      summary.json              # Aggregate summary (machine-readable)
      sessions/
        scenario-a/
          mode-a-iter-0.jsonl
          mode-b-iter-0.jsonl
        scenario-b/
          ...
    assets/                     # Reserved for future chart images
```

---

## Page Specifications

### 1. `index.md` -- Summary Page

The landing page gives a quick overview of the entire profiling run.

**Sections:**

| Section | Content |
|---------|---------|
| Run Configuration | Table with run ID, date, models, modes, scenarios, iterations, total runs, duration |
| Key Results | Per-mode-pair comparison table: metric, reduction %, 95% CI, effect size |
| Success Rates | Per-mode success rate and output validity rate |
| Links | Navigation to metrics.md, analysis.md, comparison.md, and scenario pages |

**Example:**

```markdown
# Profiling Report -- 2026-02-27

## Run Configuration
| Parameter   | Value                          |
|-------------|--------------------------------|
| Run ID      | run-20260227-120000            |
| Date        | 2026-02-27 12:00:00 UTC        |
| Models      | model-a                        |
| Modes       | mode-a, mode-b, mode-c         |
| Scenarios   | 2                              |
| Iterations  | 5 per (scenario, mode, model)  |
| Total runs  | 30                             |
| Duration    | 45m 23s                        |

## Key Results

### mode-a vs mode-b
| Metric              | Reduction | 95% CI         | Effect Size |
|---------------------|-----------|----------------|-------------|
| Active tokens       | -34.2%    | [-28.1, -40.3] | large (1.2) |
| Agent latency       | -22.1%    | [-15.4, -28.8] | medium (0.7)|
| Tool calls          | -41.5%    | [-35.0, -48.0] | large (1.5) |
| Cost                | -29.8%    | [-22.3, -37.3] | large (1.0) |
```

---

### 2. `metrics.md` -- Metrics Breakdown

Detailed statistics for every metric, grouped by mode and model.

**Sections:**
1. **Latency** -- table per mode: p50/p90/p95/min/max/IQR/CV for each timing metric
2. **Tokens** -- table per mode: p50/p90/p95 for each token bucket
3. **Tool Calls** -- table per mode: p50/p90/p95 for each tool category
4. **Cost** -- table per mode: p50/p90/p95 for cost categories
5. **Per-Scenario Breakdown** -- the above tables repeated per scenario
6. **Extension Metrics** -- tables for consumer-provided custom metrics

---

### 3. `analysis.md` -- Session Analysis

Qualitative findings from the analyzer pipeline.

**Sections:**
1. **Executive Summary** -- 3-5 bullet points on key behavioral differences
2. **Strategy Comparison** -- side-by-side comparison per scenario
3. **Efficiency Analysis** -- turn efficiency, redundant calls, wasted turns
4. **Error Patterns** -- errors encountered per mode, recovery strategies
5. **Reasoning Quality** -- planning vs reactive behavior per mode
6. **Key Insight** -- the single most important finding

---

### 4. `comparison.md` -- Cross-Mode/Model Comparison

**Sections:**
1. **Mode Comparison Matrix** -- every metric across all modes
2. **Pairwise Statistical Tests** -- p-values and effect sizes
3. **Model Comparison** (if multiple models)
4. **Reduction Heatmap** (text-based)

```
Reduction Heatmap (mode-a vs mode-b)
                         0%   10%   20%   30%   40%   50%
Active tokens      ####################################  34.2%
Agent latency      #####################                 22.1%
Tool calls         ########################################  41.5%
Cost               ###############################       29.8%
```

---

### 5. `scenarios/<id>.md` -- Per-Scenario Deep Dive

One page per scenario with iteration-level detail.

**Sections:**
1. **Scenario Definition** -- description, prompt, assertions
2. **Results Table** -- every iteration with all metrics
3. **Iteration Comparison** -- per iteration index, compare across modes
4. **Checkpoint Results** -- pass/fail per checkpoint per iteration
5. **Tool Call Sequences** -- full tool call list per iteration per mode
6. **Session Excerpts** -- notable reasoning blocks or error recoveries

---

## Data Exports

### `results.json`
Full array of `ProfileRow` objects. Canonical machine-readable output.

### `results.csv`
Flat CSV with one row per profiling iteration. Nested objects flattened
with dot-notation column names:

```csv
run_id,scenario_id,mode,model,iteration,success,timing_wall_ms,tokens_input,tokens_output,tokens_reasoning,tokens_cache_read,tokens_cache_write,tokens_total,tokens_active,tool_calls_total,cost_total_usd,...
```

Extensions are included as additional columns with their namespaced keys.

### `summary.json`
Aggregate statistics and comparison results. Machine-readable version of
the summary and comparison pages.

---

## Report Generation Flow

```
profiler report [--run-dir <path>]
    |
    +-- Load ProfileRow[] from data/results.json (or specified JSONL)
    |
    +-- Load SessionTrace[] from data/sessions/ (if available)
    |
    +-- Compute aggregate statistics (stats/ module)
    |
    +-- Run session analysis (analyzer/ module) -- if traces available
    |
    +-- Compute comparisons
    |
    +-- Generate pages in parallel:
    |       +-- summary-page.ts    --> index.md
    |       +-- metrics-page.ts    --> metrics.md
    |       +-- analysis-page.ts   --> analysis.md
    |       +-- comparison-page.ts --> comparison.md
    |       +-- scenario-page.ts   --> scenarios/<id>.md (one per scenario)
    |
    +-- Export data files:
    |       +-- json-exporter.ts   --> results.json, summary.json
    |       +-- csv-exporter.ts    --> results.csv
    |
    +-- Print summary to stdout
```
