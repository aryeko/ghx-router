# Publishing @ghx/core

This repo publishes `@ghx/core` with Changesets and GitHub Actions OIDC trusted publishing.

## One-time npm setup

1. Create the `@ghx` npm organization if it does not exist.
2. Configure a trusted publisher for this repo and workflow:
   - Repository: `aryeko/ghx`
   - Workflow file: `.github/workflows/ci-main.yml`
   - Environment: leave blank unless using a protected environment

## Release workflow

1. Add a changeset for publishable changes:

```bash
pnpm changeset
```

2. Merge to `main`.
3. CI runs `changesets/action`.
   - If pending changesets exist, it opens/updates a `chore: version packages` PR.
   - When that PR is merged, CI publishes to npm via OIDC.

No `NPM_TOKEN` is required for CI publish.

## Manual local publish (maintainers)

```bash
npm login
pnpm run ghx:publish
```

`ghx:publish` builds `@ghx/core` before publishing so tarballs always include fresh `dist/` artifacts.

Use manual publish only when CI release automation is not appropriate.
