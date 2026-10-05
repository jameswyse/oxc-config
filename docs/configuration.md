# Configure @jameswyse/oxc-config

This guide covers installation, the config files, framework profiles, project boundaries, the shared compiler settings, exceptions and formatter options. [The rule reference](../REFERENCE.md) lists what each rule rejects.

## Install

```sh
pnpm add -D @jameswyse/oxc-config oxlint oxfmt oxlint-tsgolint
```

Requires Node.js 22.23 or later. Supports Oxlint 1.86 or later, Oxfmt 0.71 or later and oxlint-tsgolint 7.0.2003 or later, within their current major versions.

The React profile uses `eslint-plugin-react-you-might-not-need-an-effect`, which declares an ESLint peer even though it runs under Oxlint. To skip installing ESLint with pnpm, add this to the project's `pnpm-workspace.yaml` before installing:

```yaml
autoInstallPeers: false
peerDependencyRules:
  ignoreMissing:
    - eslint
```

`autoInstallPeers` affects every dependency in the workspace. No ESLint configuration is needed either way.

## Create the config files

Create `oxlint.config.ts` in the project root:

```ts
import { createLintConfig } from "@jameswyse/oxc-config/oxlint";

export default createLintConfig();
```

Type-aware checking is on by default. It needs the project's `tsconfig.json` and `oxlint-tsgolint`, which uses TypeScript 7. Configurations that rely on removed options such as `baseUrl` need migrating first. For plain JavaScript or a TypeScript project that is not yet compatible, pass `typeAware: false`. Syntax and scope rules still run, and explicit `any` is still rejected.

Create `oxfmt.config.ts` beside it:

```ts
import { formatConfig } from "@jameswyse/oxc-config/oxfmt";

export default formatConfig;
```

Add the scripts:

```json
{
  "scripts": {
    "lint": "oxlint .",
    "lint:fix": "oxlint --fix . && oxfmt . && oxlint .",
    "format": "oxfmt .",
    "format:check": "oxfmt --check ."
  }
}
```

Errors fail the run. Warnings mark patterns worth reviewing that have legitimate uses, so they report without blocking: dependency cycles, barrel and forwarding modules, `typeof` outside type guards, swallowed errors, boolean parameters on exported functions, pass-through functions, tests without a matching owner file and test timeout overrides. `lint:fix` formats after applying lint fixes, then lints again to confirm the result.

The defaults enable no framework profiles or project boundaries, because both depend on the project. [Select the profiles](#select-framework-and-runtime-profiles), then [configure the boundaries](#enforce-project-boundaries) that fit.

## Select framework and runtime profiles

Enable only the tools the project uses. Each profile accepts `true` for its default scope or an array of project-relative globs. `nextjs` takes application root directories instead of globs.

```ts
import { createLintConfig } from "@jameswyse/oxc-config/oxlint";

export default createLintConfig({ react: true, vitest: true });
```

For a monorepo with separate server and browser packages:

```ts
import { createLintConfig } from "@jameswyse/oxc-config/oxlint";

export default createLintConfig({
  nextjs: ["apps/web"],
  react: ["packages/ui/**/*.{ts,tsx}"],
  node: ["packages/server/**/*.ts"],
  vitest: ["**/*.{test,spec}.{ts,tsx}"],
});
```

| Option     | Adds                                                                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react`    | React and React Compiler rules, accessibility rules, effect-misuse rules, and e18e performance rules outside tests                                                                                                   |
| `nextjs`   | The React profile plus Next.js rules, with default exports allowed for `app` and `pages` entrypoints under each root                                                                                                 |
| `node`     | Node.js environment and rules                                                                                                                                                                                        |
| `vitest`   | Vitest rules; its globs join the shared test scope                                                                                                                                                                   |
| `jest`     | Jest rules; keep its scope separate from Vitest when both exist                                                                                                                                                      |
| `effect`   | Effect error-tag and service-import rules, for modules that use [Effect](https://effect.website)                                                                                                                     |
| `tests`    | Extra test globs, such as Playwright or Node tests, for the custom test rules                                                                                                                                        |
| `electron` | Electron security rules everywhere, and an import boundary keeping `electron` and `node:*` out of the renderer (`src/renderer/**` by default, or `{ renderer: [...] }`). Needs [`root`](#enforce-project-boundaries) |

Default exports are also accepted where a tool loads them: config files, Storybook stories and `.storybook`, `sanity.cli`, GraphQL Codegen entrypoints and declaration files.

In a monorepo, run Oxlint from each package with a `tsconfig.json`, or pass an existing lint tsconfig with `--tsconfig`. Oxlint uses the nearest config file in or above the directory it runs from, so one root config can serve every package. Write its globs from the root, such as `apps/web/src/**`.

## Enforce project boundaries

These options need the project to name its owners, so the defaults cannot enable them. Most applications have a configuration owner and at least one runtime boundary, so check each option during setup. Like the profiles, their globs are relative to the config file's directory, wherever Oxlint runs from.

```ts
import { createLintConfig } from "@jameswyse/oxc-config/oxlint";

export default createLintConfig({
  root: import.meta.dirname,
  react: ["src/renderer/**"],
  env: ["src/main/config.ts", "src/renderer/env.ts"],
  boundaries: [
    {
      files: ["src/renderer/**"],
      deny: ["electron", "node:*", "@main/**", "src/main/**"],
      message: "Use the typed contextBridge API exposed by the preload process.",
    },
  ],
  serverActionGuards: ["requireStaffPermission", "requireMember"],
  clock: ["src/platform/clock.ts"],
  random: ["src/platform/ids.ts"],
});
```

- `env` lists the modules that may read `process.env` or `import.meta.env`. Other source files must receive parsed configuration. Config files and scripts are entrypoints and remain allowed.
- `boundaries` rejects imports from `files` that match a `deny` glob. Bare specifiers match as written. Relative specifiers resolve to a path from the config file's directory first, so `../main/ipc` matches `src/main/**`. Type-only imports are allowed because they are erased. Use `ignore` to exclude files from a boundary's scope. The boundary rule needs `root: import.meta.dirname` to find that directory, and `createLintConfig` throws without it when `boundaries` or `electron` is set.
- `serverActionGuards` requires every exported function in a `"use server"` module, and every inline `"use server"` function, to start by awaiting one of the named guards. Server-action modules must export each action where it is declared. A guard's name cannot prove it authorises the operation, so review the guard itself.
- `clock` and `random` list the modules that may read the current time (`Date.now()`, argument-less `new Date()`) or generate random values and IDs (`Math.random()`, `crypto.randomUUID()`, `randomUUID`/`randomInt` from `node:crypto`). Other production code must receive them, so tests can control them without faking globals. Test files, parameter defaults such as `now = new Date()` and passing `Date.now` uncalled are allowed. Durations from `performance.now()` and secret generation are out of scope.

## Share strict compiler settings

The package exports `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride` and `noFallthroughCasesInSwitch` as a base config. Extend it from the project's `tsconfig.json` and keep target, module and path settings local:

```json
{
  "extends": "@jameswyse/oxc-config/tsconfig"
}
```

In an existing project, `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` usually surface many type errors, so adopt them as a separate migration.

## Add project-specific exceptions

Append overrides to the returned config so its framework and test overrides stay active. Oxlint applies file overrides after top-level `rules`, so type-aware and framework rules can only be changed by a later override.

```ts
import { createLintConfig } from "@jameswyse/oxc-config/oxlint";

const base = createLintConfig({ react: true, vitest: true });

export default {
  ...base,
  ignorePatterns: [...base.ignorePatterns, "src/routeTree.gen.ts"],
  overrides: [
    ...base.overrides,
    {
      files: ["src/validation/**/*.ts"],
      rules: {
        "wyse/no-runtime-typeof": "off",
        "wyse/no-unsafe-dictionary-type": "off",
      },
    },
  ],
};
```

Use this for validated input seams, real timer tests, external module mocks, framework-required default exports and generated files. Keep each exception to the smallest scope. Suppression comments that no longer suppress anything are errors.

## Adjust the formatter

The formatter uses 100 columns, two spaces, double quotes, semicolons and trailing commas. It sorts imports into value and type groups and sorts `package.json` scripts. To use single quotes or add a workspace import prefix:

```ts
import { formatConfig } from "@jameswyse/oxc-config/oxfmt";

export default {
  ...formatConfig,
  singleQuote: true,
  sortImports: {
    ...formatConfig.sortImports,
    internalPattern: ["@/", "#", "@my-workspace/"],
  },
};
```

Tailwind class sorting depends on the project's Tailwind version and stylesheet, so configure Oxfmt's `sortTailwindcss` option in the project.
