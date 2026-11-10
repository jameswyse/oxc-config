# Build a preset

A preset is a package that exports its own `createLintConfig` and `createFormatConfig`, built from this package's profiles. Use one when a team wants its own defaults: different base rules, rule changes, or profiles for its stack. The rules and their scoping stay in `@jameswyse/oxc-config`, and the preset holds the team's choices.

`@jameswyse/oxc-config/oxlint` is itself a preset. Its definition is in [`src/oxlint/config.ts`](../src/oxlint/config.ts).

## Define the lint preset

`defineLintPreset` takes the profiles that always apply, the profiles a project can switch on, and rule changes. It returns the function projects call.

```ts
import { defineLintPreset } from "@jameswyse/oxc-config/oxlint/preset";
import {
  core,
  errors,
  modules,
  nextjs,
  node,
  react,
  security,
  tests,
  types,
  vitest,
} from "@jameswyse/oxc-config/oxlint/profiles";

import { reactNative } from "./profiles/react-native.ts";

export const createLintConfig = defineLintPreset({
  base: [core, types, security, errors, modules, tests],
  profiles: { node, react, nextjs, reactNative, vitest },
  rules: { "wyse/no-object-parameters": "off" },
});
```

A project then writes:

```ts
import { createLintConfig } from "@my-team/oxc-config/oxlint";

export default createLintConfig({ nextjs: true, reactNative: ["apps/mobile"] });
```

Each key of `profiles` becomes a project option, typed by its profile. A project passes the profile's option to switch it on. Leaving it out, or passing `false` or an empty list, keeps it off. Every preset also takes the standard options `root`, `typeAware`, `tests`, `rules`, `overrides` and `ignorePatterns`, which the [configuration guide](configuration.md#add-project-specific-exceptions) describes. A profile can't use one of those names.

The preset applies `base` in order, then the enabled profiles in the order `profiles` lists them. Later profiles win where two set the same rule for the same file.

The definition also takes `ignorePatterns`, which are added to the default ignore patterns for every project.

## Choose profiles

[The rule reference](../REFERENCE.md) lists the rules in each profile.

| Base profile | Rules                                                            |
| ------------ | ---------------------------------------------------------------- |
| `core`       | Legacy and error-prone built-ins, unused variables               |
| `types`      | Type safety and external data, plus the type-aware `no-unsafe-*` |
| `security`   | Hard-coded credentials, disabled TLS checks, secret fallbacks    |
| `errors`     | Control flow, promises and error handling                        |
| `modules`    | Imports, named exports, barrels, file and symbol names           |
| `comments`   | Comments, suppression reasons and console logging                |
| `mutation`   | Reassignment and copying                                         |
| `tests`      | Custom test rules on the test files                              |
| `spacing`    | `wyse/statement-spacing`                                         |

| Optional profile          | Option                                    |
| ------------------------- | ----------------------------------------- |
| `node`, `react`, `effect` | `true`, or globs for the files it covers  |
| `vitest`, `jest`          | `true`, or globs that join the test files |
| `nextjs`                  | `true`, or application root directories   |
| `electron`                | `true`, or `{ renderer: [...] }`          |
| `env`, `clock`, `random`  | The owner modules                         |
| `boundaries`              | A list of import boundaries               |
| `serverActionGuards`      | The guard function names                  |

Oxlint's correctness and suspicious categories, the base plugins, the `wyse` plugin and the default ignore patterns apply to every preset.

## Change rules

`rules` in the definition changes a rule wherever a profile enables it, the same way a project's `rules` option does. A rule that a profile enables only for test files stays scoped to test files, and a severity on its own keeps the rule's options. A project's change to the same rule replaces the preset's, in the same files.

A change to a rule no enabled profile sets applies to every file. Turning off a rule whose plugin isn't loaded, such as a React rule in a project without `react`, does nothing.

Leave a profile out of `base` to drop all of its rules. Use `rules` to change one.

## Write a profile

A profile is a function from the shared scope and its option to a list of layers. A layer is an Oxlint override that names only the extra plugins it needs, or a list of import boundaries.

```ts
import { appFiles } from "@jameswyse/oxc-config/oxlint/preset";
import { react } from "@jameswyse/oxc-config/oxlint/profiles";

import type { AppRoots, Profile } from "@jameswyse/oxc-config/oxlint/preset";

export const reactNative: Profile<AppRoots> = (scope, roots) => [
  ...react(scope, appFiles(scope, roots)),
  {
    files: appFiles(scope, roots),
    excludeFiles: scope.tests,
    rules: { "eslint/no-alert": "error" },
  },
];
```

A layer of rules has these fields:

| Field          | Meaning                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| `rules`        | The rules to set. Required                                                |
| `files`        | Globs the layer applies to. Without it, the layer applies to every file   |
| `excludeFiles` | Globs to leave out                                                        |
| `plugins`      | Native Oxlint plugins the rules need beyond the base set, such as `react` |
| `jsPlugins`    | JavaScript plugins the rules need. Resolve each specifier to a path       |
| `env`          | Environments to enable, such as `{ browser: true }`                       |

Oxlint ignores a rule whose plugin the layer doesn't list, even when another layer enabled that plugin for the same file. A layer that changes a rule from another profile's plugin must list the same plugins as that profile, such as `["react", "jsx-a11y"]` for a rule the `react` profile sets. A shorter list makes Oxlint re-enable rules from its categories that the profile turned off. A change in the preset's `rules` needs no plugin list.

A layer without `files` can't have `excludeFiles`. To apply rules everywhere except some files, set `files` to `scope.source`.

A layer of import boundaries has one field, `boundaries`, with the same items as the project's [`boundaries` option](configuration.md#enforce-project-boundaries). Each boundary layer sets the `wyse/import-boundaries` rule to every boundary declared so far, so the rule checks them all. The project must pass `root` when any profile adds one.

```ts
export const mobile: Profile<AppRoots> = (scope, roots) => [
  {
    boundaries: [
      {
        files: appFiles(scope, roots),
        deny: ["node:*"],
        message: "Mobile code can't use Node.js modules.",
      },
    ],
  },
];
```

The scope holds the globs every profile shares: `source`, `typeScript`, `javaScript`, `tests`, `endToEnd`, `entrypoints` and `programs`. It also holds the project's `typeAware` option. Use `scope.tests` to keep a rule out of test files, so the layer follows the project's `tests` option and its test runners.

`@jameswyse/oxc-config/oxlint/preset` exports these helpers:

- `filesFor(option, fallback)` returns the option's globs, or the fallback when the option is `true`.
- `appFiles(scope, roots)` returns the source files under application roots, and `appPrefixes(roots)` returns each root as a glob prefix.
- `errorRules(plugin, names)` sets each named rule of a plugin to `"error"`.

A profile that takes no option, for `base`, is a function of the scope alone and has the type `BaseProfile`.

## Extend a profile

`extendProfile` adds layers to a profile and keeps its option. Use it to add a rule to the files a built-in profile covers:

```ts
import { appFiles, extendProfile } from "@jameswyse/oxc-config/oxlint/preset";
import { nextjs as sharedNextjs } from "@jameswyse/oxc-config/oxlint/profiles";

export const nextjs = extendProfile(sharedNextjs, (scope, roots) => [
  {
    files: appFiles(scope, roots),
    excludeFiles: scope.tests,
    rules: { "my-team/no-client-env": "error" },
  },
]);
```

Extend `vitest` and `jest` this way instead of calling them from a new profile. Their globs join the test files, and `extendProfile` keeps that.

`nextjs` applies the built-in `react` profile to its application files, so extending `react` doesn't change Next.js files. To add a rule to all React code, write the layers as one function and extend both profiles with it.

## Define the format preset

`defineFormatPreset` takes the preset's Oxfmt defaults and returns the function projects call. A preset that mostly agrees with the shared formatter can start from it:

```ts
import { createFormatConfig as createSharedFormatConfig } from "@jameswyse/oxc-config/oxfmt";
import { defineFormatPreset } from "@jameswyse/oxc-config/oxfmt/preset";

export const createFormatConfig = defineFormatPreset(createSharedFormatConfig({ printWidth: 120 }));
```

A project's options replace the defaults, except that `sortImports` merges into the default import sorting and `ignorePatterns` are added to the default ones.

## Package the preset

- Depend on an exact version of `@jameswyse/oxc-config`, so a new rule reaches the team's projects only when the preset updates.
- Declare the same `oxlint`, `oxfmt` and `oxlint-tsgolint` peer dependencies as this package.
- To share the compiler settings, export a `tsconfig` that extends `@jameswyse/oxc-config/tsconfig`.
