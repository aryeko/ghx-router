#!/usr/bin/env bash
set -euo pipefail

PROVIDER=""
MODEL="gpt-5.1-codex-mini"
REPETITIONS="1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider)
      PROVIDER="${2:-}"
      shift 2
      ;;
    --provider=*)
      PROVIDER="${1#*=}"
      shift
      ;;
    --model)
      MODEL="${2:-}"
      shift 2
      ;;
    --model=*)
      MODEL="${1#*=}"
      shift
      ;;
    --repetitions)
      REPETITIONS="${2:-}"
      shift 2
      ;;
    --repetitions=*)
      REPETITIONS="${1#*=}"
      shift
      ;;
    --)
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$PROVIDER" ]]; then
  echo "Missing required --provider" >&2
  exit 1
fi

SETS=(
  "pr-exec"
  "pr-thread-mutations"
  "issues"
  "release-delivery"
  "workflows"
  "projects-v2"
  "pr-review-reads"
  "ci-diagnostics"
  "ci-log-analysis"
)

FIRST_SET=true
for SET_NAME in "${SETS[@]}"; do
  echo "[verify:mini:by-set] running set=${SET_NAME} provider=${PROVIDER} model=${MODEL} repetitions=${REPETITIONS}"

  if [[ "$FIRST_SET" == true ]]; then
    pnpm --filter @ghx-dev/benchmark run verify:set -- --set "$SET_NAME" --provider "$PROVIDER" --model "$MODEL" --repetitions "$REPETITIONS"
    FIRST_SET=false
  else
    pnpm --filter @ghx-dev/benchmark run verify:set -- --set "$SET_NAME" --provider "$PROVIDER" --model "$MODEL" --repetitions "$REPETITIONS" --skip-preflight
  fi
done

pnpm --filter @ghx-dev/benchmark run fixtures -- cleanup --out fixtures/latest.json

echo "[verify:mini:by-set] complete"
