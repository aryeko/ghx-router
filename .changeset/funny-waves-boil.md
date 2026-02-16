---
"@ghx-dev/core": patch
"@ghx-dev/benchmark": patch
---

Core updates:
- Externalize `ghx setup` skill text into a bundled `SKILL.md` asset, copy skill assets into `dist`,
  and load setup content from packaged asset paths at runtime.
- Improve setup command robustness by handling ENOENT checks consistently, awaiting skill-file reads
  in the asset loader path, and adding/refreshing unit and e2e tests for setup install/verify and
  asset error scenarios.
- Align setup usage guidance across core docs/readmes (`--scope` based usage).

Benchmark updates:
- Fix scenario schema record typing for zod v4 compatibility.

Repo tooling/docs updates included in this branch:
- Update pre-commit typecheck hook environment configuration for consistent Nx behavior.
- Add a dedicated setup command guide and synchronize onboarding references.
