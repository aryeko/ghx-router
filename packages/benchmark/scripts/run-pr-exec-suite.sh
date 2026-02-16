#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BENCH_DIR="${ROOT_DIR}/packages/benchmark"

if [[ ! -f "${ROOT_DIR}/.env.local" ]]; then
  echo "Missing ${ROOT_DIR}/.env.local" >&2
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  PNPM_CMD=(pnpm)
else
  PNPM_CMD=(corepack pnpm)
fi

SEED_ID="${BENCH_FIXTURE_SEED_ID:-app-$(date +%s)}"
MANIFEST_PATH="${BENCH_FIXTURE_MANIFEST:-fixtures/latest.json}"
GHX_PORT="${BENCH_GHX_PORT:-3001}"
AGENT_DIRECT_PORT="${BENCH_AGENT_DIRECT_PORT:-3002}"
REPETITIONS="${BENCH_REPETITIONS:-1}"

cd "${ROOT_DIR}"

set -a
source "${ROOT_DIR}/.env.local"
set +a

USER_GH_TOKEN="$(gh auth token)"

MANIFEST_DIR="$(dirname "${MANIFEST_PATH}")"
mkdir -p "${MANIFEST_DIR}"

echo "[pr-exec] Seeding fixtures: seed_id=${SEED_ID} manifest=${MANIFEST_PATH}"
"${PNPM_CMD[@]}" --filter @ghx-dev/benchmark run fixtures -- seed --seed-id "${SEED_ID}" --out "${MANIFEST_PATH}"

echo "[pr-exec] Running ghx suite: reps=${REPETITIONS} port=${GHX_PORT}"
GH_TOKEN="${USER_GH_TOKEN}" \
GHX_SKIP_GH_PREFLIGHT=1 \
BENCH_OPENCODE_PORT="${GHX_PORT}" \
"${PNPM_CMD[@]}" --filter @ghx-dev/benchmark run benchmark -- ghx "${REPETITIONS}" --scenario-set pr-exec --fixture-manifest "${MANIFEST_PATH}"

echo "[pr-exec] Running agent_direct suite: reps=${REPETITIONS} port=${AGENT_DIRECT_PORT}"
GH_TOKEN="${USER_GH_TOKEN}" \
BENCH_OPENCODE_PORT="${AGENT_DIRECT_PORT}" \
"${PNPM_CMD[@]}" --filter @ghx-dev/benchmark run benchmark -- agent_direct "${REPETITIONS}" --scenario-set pr-exec --fixture-manifest "${MANIFEST_PATH}"

echo "[pr-exec] Generating report"
"${PNPM_CMD[@]}" --filter @ghx-dev/benchmark run report

if [[ -n "${BENCH_GATE_PROFILE:-}" ]]; then
  echo "[pr-exec] Running gate profile: ${BENCH_GATE_PROFILE}"
  "${PNPM_CMD[@]}" --filter @ghx-dev/benchmark run report -- --gate --gate-profile "${BENCH_GATE_PROFILE}"
fi

echo "[pr-exec] Done. Results: ${BENCH_DIR}/results  Reports: ${BENCH_DIR}/reports"
