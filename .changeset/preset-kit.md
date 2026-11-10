---
"@jameswyse/oxc-config": major
---

Add presets, so a team can publish its own configs built from this package's rules. `@jameswyse/oxc-config/oxlint/preset` exports `defineLintPreset`, `extendProfile` and the profile types, `@jameswyse/oxc-config/oxlint/profiles` exports the rule profiles that `createLintConfig` is now built from, and `@jameswyse/oxc-config/oxfmt/preset` exports `defineFormatPreset`. The new [preset guide](https://github.com/jameswyse/oxc-config/blob/main/docs/presets.md) shows how to build one.

`createLintConfig` takes `rules`, `overrides` and `ignorePatterns` options. `rules` changes a rule wherever the config sets it, so rules set for some files, such as the type-aware and test rules, can be changed without writing an override. `overrides` and `ignorePatterns` are added to the shared ones. Spreading the returned config still works, and the lint rules each option enables are unchanged.

Breaking changes:

- `formatConfig` is replaced by `createFormatConfig`. Change `export default formatConfig` to `export default createFormatConfig()`, and pass changes as options instead of spreading. `sortImports` options merge into the shared import sorting and `ignorePatterns` are added to the shared ones.
- The `FileScope` type is `true | string[]` and no longer includes `false`. Profile options still accept `false`.
