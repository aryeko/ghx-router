---
"@ghx-dev/core": patch
---

Refactor GQL layer: split monolithic client.ts into lazy-loaded domain modules, add capability registry dispatch, and rename common-types.ts to follow .generated convention. Import cost reduced from ~2,284 lines to ~220 lines via dynamic imports.
