# Rule reference

Rules are errors, which fail the run, unless marked as warnings. Warnings flag patterns that have legitimate uses, so they report without failing. Custom rules use the `wyse/` prefix. Each one's tests sit beside it in `src/rules` or `src/vendor/anti-slop/rules` and show exactly what it reports.

Framework profiles and project options add rules only when enabled. The [configuration guide](docs/configuration.md) explains how to turn them on.

## Base rules

Oxlint's correctness and suspicious categories are errors. Unused variables are errors unless their names start with `_`, and suppression comments that no longer suppress anything are errors too. `no-underscore-dangle` is off, so fields such as `_id` and `__typename` stay valid.

## Types and external data

Native rules: `typescript/no-explicit-any` and `no-non-null-assertion`. Type-aware checking, which is on by default, adds the `no-unsafe-*` rules, `no-unsafe-type-assertion`, `no-unnecessary-type-assertion`, `switch-exhaustiveness-check` and `no-unnecessary-condition`, a nursery rule in Oxlint 1.86.

- `wyse/no-runtime-typeof` (warning): `typeof` outside a type guard. `typeof x === "undefined"` passes. Turn it off in modules that validate external input.
- `wyse/type-guard-name`: a named type predicate such as `checkUser(value): value is User`. Names such as `isUser` and `hasId` pass, as do assertion functions and anonymous callbacks.
- `wyse/no-unknown-returns`: a declared return type of `unknown` or `Promise<unknown>`.
- `wyse/no-unknown-type-aliases`: a type alias that resolves to `unknown`.
- `wyse/no-unsafe-dictionary-type`: a dictionary type whose values are `unknown`, `any`, `object` or `{}`.
- `wyse/no-object-parameters`: a parameter typed `object`, directly or through an alias.
- `wyse/no-known-value-widening`: a known value stored under a broader declared type, such as `const value: unknown = {}`.
- `wyse/no-widen-then-assert`: widening a known value, then asserting it to a narrower type.
- `wyse/no-chained-type-assertions`: chained assertions such as `value as unknown as User`.
- `wyse/no-reflect-apply` and `wyse/no-reflect-get`: `Reflect.apply` and `Reflect.get`.

These custom rules check one file at a time, without type information from other files. None of them bans `unknown` outright or rejects `as const`.

## Control flow and errors

Native rules: `curly`, `eqeqeq`, `no-empty`, `no-useless-catch` and Oxlint's promise checks. Type-aware checking adds floating and misused promise checks, `await-thenable`, `return-await` and `only-throw-error`.

- `wyse/no-deep-ternary`: a ternary nested inside two others. It replaces Oxlint's nested-ternary rule, which conflicts with Oxfmt over parentheses.
- `wyse/no-swallowed-errors` (warning): a `catch` that only returns a fallback literal, or a `.catch` callback that is empty or only returns one. Built-in parser and filesystem-probe `try` blocks, `response.json()`, and `.catch` on a promise another caller also receives all pass.
- `wyse/explicit-api-states` (warning): a boolean parameter on an exported function, exported class constructor or public method. Destructured parameters, accessors, private members, overloads and the final boolean of a `set*` or `update*` function pass.

## Modules, files and names

Native rules: `import/first`, `import/no-default-export`, `import/no-duplicates`, `import/no-self-import` and `import/no-unassigned-import`. `import/no-cycle` and `oxc/no-barrel-file` are warnings. Default exports are allowed in the files that tools load them from, listed in the [configuration guide](docs/configuration.md#select-framework-and-runtime-profiles).

- `wyse/no-forwarding-module` (warning): a module made only of re-exports, or one that re-exports its imports unchanged. Package entrypoints, Next.js `app` special files and `pages`, root `middleware`, `proxy` and `instrumentation` files, and modules with directives or side-effect imports pass.
- `wyse/no-pass-through-function` (warning): a named function whose body only calls another function with its own parameters, in order. Zero-parameter functions, method calls, type predicates and `useEffectEvent` callees pass.
- `wyse/no-generic-file-suffix`: a file named `*Contract`, `*Policy`, `policy` or `contract`, in any case style. Test and story files pass, as do header policies such as a content security policy and files that export a binding with the file's name, such as `agentPolicy.ts` exporting `AgentPolicy`.
- `wyse/no-shape-in-symbol-names`: a name containing "shape", in any letter case.

## Comments and logging

- `wyse/no-comments`: line, block and JSDoc comments. Shebangs, JSDoc type tags in JavaScript files and tool directives pass. The directives include lint suppressions, `@ts-expect-error`, triple-slash references, `#__PURE__`, formatter and coverage ignores, bundler magic comments, and test-environment and JSX pragmas. The `allow` option adds more patterns.
- `eslint/no-console`: console calls outside config files and scripts.

## Mutation and copying

Native rules: `prefer-const`, `no-param-reassign` and `oxc/no-accumulating-spread`. Type-aware checking adds `prefer-readonly`.

- `wyse/no-array-filter-map`: adjacent `filter` and `map` passes over an array.
- `wyse/no-reduce-accumulator-copy`: copying a reducer's accumulator with `Object.assign`, `Array.from` or an array copy method.
- `wyse/no-conditional-empty-object-spread`: spreading a conditional empty object to omit fields, such as `...(id ? { id } : {})`.

## Project ownership

These rules run only once the project names its owners through the [project boundary options](docs/configuration.md#enforce-project-boundaries).

- `wyse/no-env-access` (`env`): reading `process.env` or `import.meta.env`, or destructuring `env` from either, outside the owners, config files and scripts. It doesn't check that the owner validates what it reads.
- `wyse/import-boundaries` (`boundaries`): a value import, re-export or literal dynamic import that matches a `deny` glob. Type-only imports pass. It doesn't check `require` or computed imports.
- `wyse/server-action-guard` (`serverActionGuards`): a `"use server"` action that doesn't start by awaiting a guard, and indirect or default exports from server-action modules. Non-exported helpers and test files pass.
- `wyse/no-ambient-clock` (`clock`): `Date.now()` and argument-less `new Date()`, including through `globalThis` or `window`. Parameter defaults, uncalled `Date.now`, provider functions that only return the read, and test files pass.
- `wyse/no-ambient-random` (`random`): `Math.random()`, `crypto.randomUUID()`, and `randomUUID` or `randomInt` from `node:crypto`. The same exceptions apply. `randomBytes` and `getRandomValues` pass because they generate secrets.

## Tests

These rules run on the default test globs, the `tests` paths and the Jest and Vitest profile scopes. The `vitest` and `jest` profiles add native checks for focused, disabled and conditional tests, standalone expectations and valid `expect` calls.

- `wyse/no-fixed-test-delay`: an awaited literal timer delay, or Playwright's `waitForTimeout`. Genuine timer tests need a scoped exception.
- `wyse/no-vacuous-test-assertions`: an expectation that compares two literals, or the same identifier on both sides of `toBe`, `toEqual` or `toStrictEqual`.
- `wyse/no-edit-proof-assertions`: an assertion that only proves an import exists or is a function, such as `toBeDefined` on an import, `toBeTypeOf("function")` or `toHaveProperty` on a namespace.
- `wyse/no-test-timeout-overrides` (warning): timeout and retry overrides such as `test.setTimeout`, `test.slow()`, `describe.configure`, `vi.setConfig` and `jest.setTimeout`. End-to-end files under `e2e/` or named `*.e2e.*` pass.
- `wyse/companion-has-owner` (warning): a `.test`, `.spec` or `.bench` file with no matching sibling module or directory. Files with an `integration` or `e2e` segment, and files under `tests/`, `test/`, `__tests__/` or `e2e/`, pass.
- `wyse/no-module-mocking`: Vitest and Jest module mocking. Replace dependencies through real interfaces, or add a file-scoped exception for an external system.

## Framework profiles

- `react` adds React and React Compiler rules, `jsx-a11y` correctness and suspicious rules, `react-you-might-not-need-an-effect`, and e18e performance rules outside tests.
- `nextjs` adds the React rules plus Next.js rules.
- `effect` adds `wyse/no-manual-effect-error-tag` and `wyse/no-service-constructor-imports`.
- `electron` adds a renderer import boundary and these rules:
  - `wyse/electron-no-remote-module`: `remote` from `electron`, or `@electron/remote`, by import, `require`, dynamic import or re-export.
  - `wyse/electron-secure-web-preferences`: `webPreferences` without literal `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`, or with web security disabled, insecure content, or experimental or Blink features enabled. Later keys, spreads and computed keys that override these settings are reported too. Preferences passed from a variable the rule can't resolve pass.
  - `wyse/electron-no-raw-ipc-renderer-exposure`: exposing `ipcRenderer` or its methods through `contextBridge`, forwarding renderer-chosen channels or arguments, or passing renderer callbacks straight to `on` or `once`.

## Formatting

Oxfmt formats the code. `wyse/statement-spacing` requires a blank line after the imports, around multiline blocks and declarations, and before `return`. Consecutive imports, consecutive one-line statements, and a type alias directly after the multiline declaration it derives from stay together. It's the only custom rule with an autofix.
