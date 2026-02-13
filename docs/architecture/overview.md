# Architecture Overview

`ghx-router` is built around three boundaries:

- `src/core/`: task contracts, route policy, adapters, normalization, telemetry.
- `src/cli/`: command interface and formatting.
- `bench/`: independent benchmark harness and reporting.

The canonical architecture spec is:

- `docs/plans/2026-02-13-ghx-router-architecture.md`

Supporting references:

- `docs/architecture/repository-structure.md`
- `docs/architecture/routing-policy.md`
- `docs/architecture/contracts.md`
- `docs/architecture/errors-and-retries.md`

This file is a stable summary and index to deeper architecture docs.
