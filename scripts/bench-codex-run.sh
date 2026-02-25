#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$SCRIPT_DIR")"
REPORT_DIR=$REPO/reports/codex-comparison
ITER_LOGS=$REPORT_DIR/iter-logs
LOG=$REPORT_DIR/run.log

mkdir -p "$ITER_LOGS"
exec > >(tee -a "$LOG") 2>&1

echo "=== Benchmark run started at $(date) ==="
echo "Report dir: $REPORT_DIR"
echo "Model: gpt-5.3-codex | Iterations: 5 | Scenarios: all | Warmup: yes"
echo ""

# Ensure GITHUB_TOKEN is available for the benchmark runner
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  GITHUB_TOKEN=$(gh auth token)
  export GITHUB_TOKEN
  echo "GITHUB_TOKEN: sourced from gh auth token"
else
  echo "GITHUB_TOKEN: already set in environment"
fi

cd "$REPO"

# ── agent_direct run ─────────────────────────────────────────────────────────
BEFORE_AD=$(find "$ITER_LOGS" -mindepth 2 -maxdepth 2 -type d 2>/dev/null | sort || true)
echo "=== [1/3] Running agent_direct (5 iter, all scenarios) ==="
BENCH_LOGS_DIR="$ITER_LOGS" \
  pnpm run benchmark -- agent_direct 5 \
    --scenario-set all \
    --model gpt-5.3-codex

AFTER_AD=$(find "$ITER_LOGS" -mindepth 2 -maxdepth 2 -type d | sort)
AD_RUN_DIR=""
while IFS= read -r dir; do
  if ! echo "$BEFORE_AD" | grep -qF "$dir"; then
    AD_RUN_DIR="$dir"
    break
  fi
done <<< "$AFTER_AD"
echo "→ agent_direct run dir: $AD_RUN_DIR"
[[ -n "$AD_RUN_DIR" ]] || { echo "ERROR: could not identify agent_direct run directory" >&2; exit 1; }

# ── ghx run ──────────────────────────────────────────────────────────────────
echo ""
echo "=== [2/3] Running ghx (5 iter, all scenarios) ==="
BEFORE_GHX=$(find "$ITER_LOGS" -mindepth 2 -maxdepth 2 -type d | sort)
BENCH_LOGS_DIR="$ITER_LOGS" \
  pnpm run benchmark -- ghx 5 \
    --scenario-set all \
    --model gpt-5.3-codex

AFTER_GHX=$(find "$ITER_LOGS" -mindepth 2 -maxdepth 2 -type d | sort)
GHX_RUN_DIR=""
while IFS= read -r dir; do
  if ! echo "$BEFORE_GHX" | grep -qF "$dir"; then
    GHX_RUN_DIR="$dir"
    break
  fi
done <<< "$AFTER_GHX"
echo "→ ghx run dir: $GHX_RUN_DIR"
[[ -n "$GHX_RUN_DIR" ]] || { echo "ERROR: could not identify ghx run directory" >&2; exit 1; }

# ── report:iter ───────────────────────────────────────────────────────────────
echo ""
echo "=== [3/3] Generating comparison report ==="
echo "GHX: $GHX_RUN_DIR"
echo "AD:  $AD_RUN_DIR"

pnpm --filter @ghx-dev/benchmark run report:iter -- \
  "$GHX_RUN_DIR" \
  "$AD_RUN_DIR" \
  --output "$REPORT_DIR/comparison.md"

echo ""
echo "=== Done at $(date) ==="
echo "Report: $REPORT_DIR/comparison.md"
