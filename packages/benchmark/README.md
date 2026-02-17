# @ghx-dev/benchmark (Private)

Internal benchmark harness for `ghx` maintainers.

This package is intentionally **private** and is not published to npm. It compares baseline `agent_direct` runs against `ghx` runs for correctness, latency, token usage, and tool-call counts.

## What It Covers

- Scenario schemas and validation
- Benchmark CLI runner and scenario execution
- Parsing/extraction helpers for benchmark outputs
- Summary report generation and gate checks

## Common Commands

```bash
# from repo root (recommended shortcuts)
pnpm run benchmark:verify:pr
pnpm run benchmark:verify:release

# package-level commands
pnpm --filter @ghx-dev/benchmark run benchmark -- agent_direct 1 --scenario pr-view-001

pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 4 --scenario-set ci-verify-pr
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 4 --scenario-set ci-verify-release
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 --scenario-set pr-exec
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 --scenario-set issues
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 --scenario-set release-delivery
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 --scenario-set workflows
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 --scenario-set projects-v2

# fixture lifecycle (sandbox repo)
BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH=/path/to/app.private-key.pem pnpm --filter @ghx-dev/benchmark run fixtures:env:bootstrap
pnpm --filter @ghx-dev/benchmark run fixtures -- seed --repo aryeko/ghx-bench-fixtures --out fixtures/latest.json --seed-id local
pnpm --filter @ghx-dev/benchmark run fixtures -- status --out fixtures/latest.json
pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 1 --scenario-set pr-exec --fixture-manifest fixtures/latest.json
pnpm --filter @ghx-dev/benchmark run fixtures -- cleanup --out fixtures/latest.json

# suite runner (config-driven, recommended for repeatable local runs)
pnpm --filter @ghx-dev/benchmark run suite:config -- --out config/suite-runner.json --scenario-set ci-verify-pr --repetitions 3 --gate-profile verify_pr --with-cleanup --with-seed
pnpm --filter @ghx-dev/benchmark run suite:run -- --config config/suite-runner.json
pnpm --filter @ghx-dev/benchmark run suite:run -- --config config/suite-runner.json --skip-cleanup --skip-seed --no-gate

pnpm --filter @ghx-dev/benchmark run report
pnpm --filter @ghx-dev/benchmark run report:gate
pnpm --filter @ghx-dev/benchmark run report -- --gate --gate-profile verify_pr --expectations-model openai/gpt-5.1-codex-mini

pnpm --filter @ghx-dev/benchmark run benchmark -- ghx 3 --scenario-set pr-exec
pnpm --filter @ghx-dev/benchmark exec tsx src/cli/report.ts --gate --gate-profile verify_pr

pnpm --filter @ghx-dev/benchmark run test
pnpm --filter @ghx-dev/benchmark run typecheck
```

## Scenario Sets

- `default` - stable and mutation-free
- `ci-verify-pr` - lightweight PR gate set (2 scenarios)
- `ci-verify-release` - stable release gate set (5 scenarios)
- `pr-exec`
- `issues`
- `release-delivery`
- `workflows`
- `projects-v2`
- `all` - exact union of A-D roadmap sets

Additional sets:

- `full-seeded` - full roadmap coverage against seeded sandbox fixtures

## Outputs

- Latest summary: `packages/benchmark/reports/latest-summary.md`
- Scenario definitions: `packages/benchmark/scenarios/`

Notes:

- Use mode `ghx`.
- For benchmark runs, `ghx run` skips per-call CLI preflight by default; suite preflight performs auth verification once.
- Suite preflight currently supports Unix-like environments because it executes the symlinked `packages/benchmark/bin/ghx` command.
- Mutation-heavy scenarios should target sandbox repo `aryeko/ghx-bench-fixtures`, not `aryeko/ghx`.
- Use `--fixture-manifest` (or `BENCH_FIXTURE_MANIFEST`) to resolve scenario input bindings.
- `suite:run` executes phases in order: `fixtures.setup` -> parallel benchmark (`ghx` + `agent_direct`) -> `reporting.analysis.report` -> optional `reporting.analysis.gate`.
- `suite:config` writes grouped config with benchmark base command + per-mode extensions (env/args), and defaults ports to `3001` (ghx) / `3002` (agent_direct) for parallel runs.
- `suite:config` does not include fixture setup phases unless `--with-cleanup` / `--with-seed` are provided.
- Gate expectations are model-aware and configured in `packages/benchmark/config/expectations.json`.
- `fixtures:env:bootstrap` reads app IDs from repo variables (`BENCH_FIXTURE_GH_APP_ID`, `BENCH_FIXTURE_GH_APP_INSTALLATION_ID`) and writes `.env.local`.
- GitHub Actions secret values are write-only; private key content must come from local env (`BENCH_FIXTURE_GH_APP_PRIVATE_KEY`) or local path (`BENCH_FIXTURE_GH_APP_PRIVATE_KEY_PATH`).

For benchmark methodology and reporting details, see:

- `docs/benchmark/methodology.md`
- `docs/benchmark/metrics.md`
- `docs/benchmark/reporting.md`
