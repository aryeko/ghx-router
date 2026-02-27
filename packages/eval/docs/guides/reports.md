# Reports

Output directory structure, session trace format, and key metrics to focus on.

## Output Directory Structure

After an evaluation run, results and reports are organized under the configured output directories:

```
results/
  run-001.jsonl                          # ProfileRow records (one per iteration)

reports/
  2026-02-27T12-00-00/
    report.md                            # Markdown summary report
    report.csv                           # CSV data for spreadsheet analysis
    report.json                          # Machine-readable JSON report
    sessions/
      pr-review-comment-001/
        ghx-iter-1.json                  # Session trace: ghx mode, iteration 1
        ghx-iter-2.json
        baseline-iter-1.json
        mcp-iter-1.json
      pr-fix-mixed-threads-wf-001/
        ghx-iter-1.json
        baseline-iter-1.json
        ...
```

- **`results/`** -- raw JSONL files containing `ProfileRow` records. Each line is one iteration with metrics, scores, timing, and custom collector data. These files are the primary data artifact.
- **`reports/`** -- generated reports in multiple formats. Each run creates a timestamped subdirectory.
- **`reports/sessions/`** -- exported session traces organized by scenario. Available when `output.session_export: true` in config.

## Session Trace Export Format

Session traces are exported as JSON files following the naming convention:

```
<scenarioId>/<mode>-iter-<n>.json
```

For example: `pr-review-comment-001/ghx-iter-3.json` contains the full session trace for the ghx mode, third iteration of the `pr-review-comment-001` scenario.

Each trace file contains the `SessionTrace` structure from the profiler, including:
- All tool calls with names, inputs, and outputs
- Token usage per turn
- Timing information
- Agent reasoning steps (when available from the provider)

Traces enable post-hoc analysis via `eval analyze` without re-running the evaluation.

## Report Formats

| Format | File | Use Case |
|--------|------|----------|
| Markdown | `report.md` | Human-readable summary with tables and comparisons |
| CSV | `report.csv` | Import into spreadsheets or data analysis tools |
| JSON | `report.json` | Programmatic access to structured report data |

Generate specific formats with the `--format` flag:

```bash
pnpm --filter @ghx-dev/eval run eval report \
  --results results/run-001.jsonl \
  --format md
```

## Key Metrics to Focus On

### Tool Call Classification

The primary metric for comparing modes. Look for:
- **ghx mode**: high `ghx.capabilities_used`, low `ghx.bash_commands`
- **mcp mode**: high `ghx.mcp_tools_invoked`, low `ghx.bash_commands`
- **baseline mode**: high `ghx.gh_cli_commands` and `ghx.bash_commands`

A successful evaluation shows ghx mode using fewer total tool calls with higher checkpoint pass rates.

### Token Usage

Compare `inputTokens` and `outputTokens` across modes. Structured routing (ghx) should require less token overhead for the same task.

### Checkpoint Pass Rate

The percentage of checkpoint assertions that pass per mode. This is the functional correctness signal -- a mode that fails checkpoints is not completing the task regardless of efficiency.

### Timing

`durationMs` per iteration. Compare median and p95 values across modes using the statistical analysis in the report.

For detailed guidance on statistical interpretation (bootstrap confidence intervals, Cohen's d effect sizes, permutation tests), see [Interpreting Results](../methodology/interpreting-results.md).

## Related Documentation

- [Guides Hub](./README.md) -- all available guides
- [Running Evaluations](./running-evaluations.md) -- CLI commands that produce these outputs
- [Interpreting Results](../methodology/interpreting-results.md) -- statistical methods for comparing modes
- [Metrics](../methodology/metrics.md) -- metric definitions and collection pipeline
