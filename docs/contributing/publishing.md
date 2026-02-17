# Publishing @ghx-dev/core

This repo publishes `@ghx-dev/core` with Changesets and GitHub Actions OIDC trusted publishing.

## Creating Changesets

Before publishing, create a changeset to document the change:

```bash
pnpm run changeset
```

- Add a changeset for user-facing changes.
- Keep changeset summaries concise and user-oriented.
- Ensure `pnpm run ci` passes before merging.

## Local Changeset Commands

- `pnpm run changeset` - create a new changeset entry.
- `pnpm run changeset:status` - inspect pending release state.
- `pnpm run changeset:version` - apply version updates.
- `pnpm run changeset:publish` - publish release artifacts.

## CI Release Behavior

The main workflow runs release logic after successful `build-and-test`. Release behavior is keyed off version commits with message:

```text
chore: version packages
```

**Process:**

1. CI runs `changesets/action`.
   - If pending changesets exist, it opens/updates a `chore: version packages` PR.
   - When that PR is merged, CI publishes to npm via OIDC.

- Dist artifacts are restored from CI before publish.

## One-time npm Setup (Maintainers)

1. Create the `@ghx-dev` npm organization if it does not exist.
2. Configure a trusted publisher for this repo and workflow:
   - Repository: `aryeko/ghx`
   - Workflow file: `.github/workflows/ci-main.yml`
   - Environment: leave blank unless using a protected environment

No `NPM_TOKEN` is required for CI publish when using OIDC trusted publishing.

## Manual Local Publish (Maintainers)

```bash
npm login
pnpm --filter @ghx-dev/core publish --no-git-checks
```

`@ghx-dev/core` runs `prepack` on publish, which builds fresh `dist/` artifacts before packaging.

Use manual publish only when CI release automation is not appropriate.
