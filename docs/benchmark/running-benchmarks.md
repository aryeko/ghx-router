# Running Benchmarks

A practical guide for executing benchmarks locally, interpreting results, and gating releases.

## Prerequisites

1. **opencode CLI** — benchmark harness uses opencode to run isolated assistant sessions:
   ```bash
   # Install opencode (check current version from project docs)
   npm install -g @braneproject/opencode
   ```

2. **GitHub Token** — read/write access for fixture operations and API calls:
   ```bash
   export GITHUB_TOKEN=ghp_...
   # Or configure via gh CLI:
   gh auth login
   ```

3. **Fixture Setup** (for mutation scenarios):
   ```bash
   # First time only
   BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH=/path/to/app.private-key.pem \
   pnpm --filter @ghx-dev/benchmark run fixtures:env:bootstrap

   # Before benchmark with mutations
   pnpm --filter @ghx-dev/benchmark run fixtures -- \
     seed --repo aryeko/ghx-bench-fixtures \
     --out fixtures/latest.json --seed-id local
   ```

4. **Node.js >=22** — check with `node --version`

5. **pnpm** — install via `npm install -g pnpm`

## Basic Benchmark Commands

### Run a Single Mode Against One Scenario

```bash
# agent_direct mode, 1 repetition, specific scenario
pnpm --filter @ghx-dev/benchmark run benchmark -- agent_direct 1 --scenario pr-view-001

# ghx mode, 4 repetitions, scenario set
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 4 --scenario-set default
```

**Output:** JSONL rows written to `packages/benchmark/results/`

### Run Full Benchmark Suite (Recommended)

```bash
# Lightweight PR verification (2 scenarios, 4 reps)
pnpm run benchmark:verify:pr

# Full release verification (5 scenarios, 4 reps)
pnpm run benchmark:verify:release
```

### Run with Suite Runner (for Repeatable Configurations)

Suite runner is the recommended approach for local development as it handles seeding, cleanup, and parallel mode execution:

```bash
# Step 1: Generate suite configuration
pnpm --filter @ghx-dev/benchmark run suite:config -- \
  --out config/suite-runner.json \
  --scenario-set pr-exec \
  --repetitions 3 \
  --gate-profile verify_pr \
  --with-cleanup \
  --with-seed

# Step 2: Run the suite
pnpm --filter @ghx-dev/benchmark run suite:run -- --config config/suite-runner.json
```

**Flags:**
- `--scenario-set` — which scenario set to run (default: `default`)
- `--repetitions` — reps per scenario (default: 1)
- `--gate-profile` — validation profile: `verify_pr` or `verify_release`
- `--with-seed` — include fixture seeding phase
- `--with-cleanup` — include fixture cleanup phase

### Run Without Seeding/Cleanup (Iteration)

```bash
# Re-run suite without re-seeding fixtures (faster for iteration)
pnpm --filter @ghx-dev/benchmark run suite:run -- \
  --config config/suite-runner.json \
  --skip-cleanup \
  --skip-seed
```

### Run Against Fixture Manifest

For mutation scenarios that require specific fixture state:

```bash
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 \
  --scenario-set pr-exec \
  --fixture-manifest fixtures/latest.json
```

## Interpreting Results

### Raw JSONL Rows

After each benchmark run, rows are written to `packages/benchmark/results/`:

```jsonl
{"scenario_id": "pr-view-001", "mode": "ghx", "success": true, "output_valid": true, "tokens": {"total": 1234, "cache_read": 100}, "latency_ms": 2150, "tool_calls": 2, ...}
{"scenario_id": "pr-view-001", "mode": "agent_direct", "success": true, "output_valid": true, "tokens": {"total": 2500, "cache_read": 0}, "latency_ms": 3200, "tool_calls": 2, ...}
```

**Key fields:**
- `success` — CLI executed without error
- `output_valid` — envelope matched scenario assertions
- `tokens` — token usage (active tokens = total - cache_read)
- `latency_ms` — elapsed time from prompt to result
- `tool_calls` — number of tool invocations
- `error.type` — failure category if not success (runner_error, timeout, validation, etc.)

### Summary Report

Human-readable summary generated automatically:

```bash
pnpm --filter @ghx-dev/benchmark run report
```

Output: `packages/benchmark/reports/latest-summary.md`

**Sections:**
- Scenario coverage and run counts
- Median metrics per mode (tokens, latency, tool calls)
- Success and validity rates
- Reliability metrics (runner failure, timeout, retry rates)
- Efficiency reductions (%, scenario win rates)
- Gate v2 outcome (PASS/FAIL with profile)
- Profiling snapshot (reasoning time, tool time, latency breakdown)

### Machine-Readable Summary

JSON summary for programmatic access:

```bash
# View JSON summary
cat packages/benchmark/reports/latest-summary.json
```

Fields include:
- `summary.reliability` — success/validity/failure rates
- `summary.efficiency` — median reductions by mode
- `scenarios_per_mode` — per-scenario metrics and win/loss status
- `gate_v2_outcome` — pass/fail with deltas

## Report Gating

### Check Gate Status (v2)

```bash
# Using default profile (verify_pr)
pnpm --filter @ghx-dev/benchmark run report:gate

# Using specific profile
pnpm --filter @ghx-dev/benchmark run report -- --gate --gate-profile verify_release
```

**Exit code:** `0` if pass, `1` if fail

**Gate v2 rules:**
- **Reliability** — success rate, validity, failure/timeout/retry rates
- **Efficiency** — active-token, latency, and tool-call reductions (stable sample only)

Both must pass for overall PASS.

### Understand Gate Failures

If gate fails, check:

1. **Reliability failures:**
   - Success rate delta: Is `ghx` significantly worse than baseline?
   - Output validity: Are assertions failing for certain scenarios?
   - Runner errors: Are timeouts or CLI failures happening?

2. **Efficiency failures:**
   - Scenario coverage: Are enough scenarios completing successfully?
   - Token/latency/tool reductions: Are improvements below threshold?
   - Per-scenario losses: Which scenarios are lagging?

Debug with:

```bash
# Raw JSON to see per-scenario details
jq '.scenarios_per_mode' packages/benchmark/reports/latest-summary.json

# JSONL filtering for scenario details
grep 'pr-view-001' packages/benchmark/results/*.jsonl | jq -s 'group_by(.mode) | map({mode: .[0].mode, count: length, success_rate: (map(.success) | map(select(.) | true) | length / length)})'
```

## Common Workflows

### Quick PR Check (Local Development)

```bash
# 1. Build core changes
pnpm run build

# 2. Run quick verification
pnpm run benchmark:verify:pr

# 3. View gate status
cat packages/benchmark/reports/latest-summary.md
```

**Time:** ~3-5 minutes

### Full Scenario Coverage (Pre-Release)

```bash
# 1. Seed fixtures
pnpm --filter @ghx-dev/benchmark run fixtures -- \
  seed --repo aryeko/ghx-bench-fixtures \
  --out fixtures/latest.json --seed-id local

# 2. Generate and run suite
pnpm --filter @ghx-dev/benchmark run suite:config -- \
  --out config/suite-runner.json \
  --scenario-set full-seeded \
  --repetitions 3 \
  --gate-profile verify_release \
  --with-cleanup --with-seed

pnpm --filter @ghx-dev/benchmark run suite:run -- --config config/suite-runner.json

# 3. Check gate
pnpm --filter @ghx-dev/benchmark run report -- --gate --gate-profile verify_release
```

**Time:** ~15-30 minutes

### Iterate on a Single Scenario

```bash
# 1. Seed once
pnpm --filter @ghx-dev/benchmark run fixtures -- \
  seed --repo aryeko/ghx-bench-fixtures \
  --out fixtures/latest.json --seed-id local

# 2. Run specific scenario multiple times
for i in {1..3}; do
  pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 \
    --scenario-set pr-exec \
    --fixture-manifest fixtures/latest.json
done

# 3. Report
pnpm --filter @ghx-dev/benchmark run report

# 4. Cleanup
pnpm --filter @ghx-dev/benchmark run fixtures -- cleanup --out fixtures/latest.json
```

## CI Integration

### PR Verification (`.github/workflows/ci-pr.yml`)

```bash
pnpm run benchmark:verify:pr
```

Runs 2 scenarios, 4 reps, gate profile `verify_pr`.

### Release Verification (`.github/workflows/ci-main.yml`)

```bash
pnpm run benchmark:verify:release
```

Runs 5 scenarios, 4 reps, gate profile `verify_release`, before publish.

Both must exit with code 0 for CI to proceed.

## Environment Variables

- `GITHUB_TOKEN` — GitHub API token (required)
- `BENCH_FIXTURE_MANIFEST` — path to fixture manifest (default: `fixtures/latest.json`)
- `BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH` — path to GitHub App private key (for fixture setup)
- `BENCH_FIXTURE_GH_APP_PRIVATE_KEY` — inline private key (alternative to `PATH` variant)
- `BENCH_FIXTURE_GH_APP_ID` — GitHub App ID (from repo variables)
- `BENCH_FIXTURE_GH_APP_INSTALLATION_ID` — app installation ID (from repo variables)

## Troubleshooting

### "opencode not found"

Install opencode CLI:

```bash
npm install -g @braneproject/opencode
```

### "GITHUB_TOKEN not set"

Set token before running:

```bash
export GITHUB_TOKEN=ghp_...
gh auth login
```

### Scenarios timeout or fail to complete

- Increase `--timeout_ms` in scenario JSON (default: 60000ms)
- Check fixture status: `pnpm --filter @ghx-dev/benchmark run fixtures -- status --out fixtures/latest.json`
- Check opencode port conflicts: default ports are 3001 (ghx) and 3002 (agent_direct)

### Gate fails but metrics look good

- Check profile: verify correct profile is selected (`verify_pr` vs `verify_release`)
- Check coverage: `jq '.summary.efficiency.scenario_coverage_pct' packages/benchmark/reports/latest-summary.json`
- Compare to thresholds in [Efficiency Criteria](./efficiency-criteria.md)

## Reference Commands

```bash
# List all scenario IDs
jq -r 'to_entries[] | .value[]' packages/benchmark/scenario-sets.json | sort -u

# Count scenarios per set
jq 'map_values(length)' packages/benchmark/scenario-sets.json

# View scenario metadata
jq '.' packages/benchmark/scenarios/pr-view-001.json

# Parse latest summary
jq '.summary.reliability' packages/benchmark/reports/latest-summary.json
jq '.summary.efficiency' packages/benchmark/reports/latest-summary.json

# Filter results by mode
jq -s 'map(select(.mode == "ghx"))' packages/benchmark/results/*.jsonl | jq -s 'length'
```

## See Also

- [Scenario Authoring](./scenario-authoring.md) — how to write new scenarios
- [Methodology](./methodology.md) — run controls and aggregation strategy
- [Metrics](./metrics.md) — detailed metric definitions
- [Efficiency Criteria](./efficiency-criteria.md) — gate validation thresholds
