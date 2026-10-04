# @jameswyse/oxc-config

## 0.2.0

### Minor Changes

- 463ae11: `boundaries` and the `electron` profile now need `root: import.meta.dirname`, and their globs resolve from the config file's directory like every other option. Previously they resolved from the directory Oxlint ran from, so boundaries in a root config never matched when a monorepo linted each package from its own directory. `createLintConfig` throws when `root` is missing.

  Fix the `formatConfig` type so `...formatConfig.sortImports` typechecks, and stop the React profile flagging label text nested more than two elements deep or table cells without text.
