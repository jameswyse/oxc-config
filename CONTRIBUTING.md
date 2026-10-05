# Contributing

## Develop

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs the rule tests, lints real consumer configs in temporary projects, checks type-aware diagnostics and formatter convergence, then lints, typechecks, checks formatting and builds `dist`.

## Release

Add a changeset to any pull request that should ship:

```sh
pnpm changeset
```

On `main`, the release workflow keeps a "chore(release): version packages" pull request up to date with the pending changesets. Merging it publishes the new version to npm with provenance, tags it and creates a GitHub release.
