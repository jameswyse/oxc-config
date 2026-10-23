# @jameswyse/oxc-config

## 0.6.1

### Patch Changes

- 5fe4076: Depend on `@oxlint/plugins` `>=1.86.0 <2`, the same range as the `oxlint` peer, instead of exactly 1.88.0, so a project can update `@oxlint/plugins` to the newest 1.x without waiting for a new release of this package.

## 0.6.0

### Minor Changes

- 2ca61ac: `no-env-access` reports `env` destructured from `process` in a parameter default or a destructuring assignment, not only in a variable declaration, such as `({ env } = process) => env.PORT`, `function read({ env: e } = process)`, a method parameter, or `({ env } = process);`. This covers renamed and computed-literal keys, a pattern nested under `env` such as `({ env: { PORT } } = process)`, and the global `process`, `globalThis.process`, `import.meta`, the default or namespace import of `node:process` or `process`, and a required `process`. Destructuring `env` through a namespace's `default`, such as `({ default: { env } } = p)`, and a rest element such as `({ ...rest } = process)` still pass. Projects with an `env` owner list may see new errors.
- 2ca61ac: `no-ambient-clock` reports a date-fns helper that reads the clock when it's exported as a name destructured from a namespace, such as `export const { isPast } = dates` or `export const { isPast: past } = require("date-fns")`, matching an exported `const` alias such as `export const check = isPast`. Destructuring now follows nested keys, so `const { default: { isPast } } = await import("date-fns")` resolves like `.default.isPast`. Other names destructured from date-fns, and properties of a helper such as `{ isPast: { name } }`, still pass. Projects with a `clock` owner list may see new errors.

## 0.5.0

### Minor Changes

- 8ed41cc: `no-ambient-clock` reports a date-fns helper that reads the clock wherever it's used, not only where it's called: passed uncalled, such as `dates.filter(isPast)`, stored, such as `{ check: isToday }`, or exported by local name, such as `export { isPast }` or `export default isPast`. `isMatch` and `isMatchWithOptions` from `date-fns/fp` report once at the end of their call chain, so a partial application such as `values.filter(isMatch("yyyy"))` now reports. This covers helpers imported by name, through a namespace, from a `date-fns/<name>` subpath, by literal dynamic import or by `require`. Type positions such as `typeof isPast`, type-only imports and exports, parameter defaults such as `check = isPast`, and local bindings that shadow a helper still pass. Projects with a `clock` owner list may see new errors.
- f72a77a: `no-env-access` reports `env` read from `require("node:process")` or `require("process")`, whether `require` is Node's own or a loader made with `createRequire` from `node:module` or `module`, stored as in `const require = createRequire(import.meta.url)`, copied to another `const` or called directly as in `createRequire(import.meta.url)("node:process").env`. Destructuring, aliases, computed keys and `Reflect.get` apply as they do to an imported `process`, and a `require` function the file defines itself, or a loader variable that's reassigned, still passes. `import-boundaries` now also checks a directly called `createRequire(import.meta.url)("…")` and a `const` copy of a loader, and no longer treats a function destructured from a `createRequire` loader, such as `resolve`, or a reassigned loader variable as `require`. Projects with an `env` owner list may see new errors.
- 1d4e971: Test rules resolve test APIs read from a module loaded with `require`, such as `const { test, mock } = require("node:test")` or `const { setTimeout } = require("node:timers/promises")`. A required module resolves as a namespace, as a dynamic import does, so calling it directly, as in `const test = require("node:test"); test(...)`, still isn't recognised the way a default import is. `no-uncontrolled-test-clock`, `no-test-timeout-overrides`, `no-fixed-test-delay` and the other rules that recognise test callbacks now see tests registered through a required API. Projects with CommonJS tests may see new errors.

## 0.4.0

### Minor Changes

- 949d25c: `no-ambient-clock` reports more current-time reads outside the `clock` owners: argument-less `new TZDate()` and `new TZDateMini()` and one-argument `TZDate.tz(zone)` from `@date-fns/tz`, `@date-fns/tz/date` or `@date-fns/tz/date/mini`, and calls to the date-fns helpers that read the clock, such as `constructNow`, `startOfToday`, `isToday`, `isPast`, `isThisWeek`, `formatDistanceToNow` and `isMatch`, whether imported by name, through a namespace, from a `date-fns/<name>` subpath, from `date-fns/fp` once fully applied, or by literal dynamic import. Re-exporting those helpers by name, or with `export * from "date-fns"`, `date-fns/fp` or a helper's subpath, also reports. Parentheses, `as`, `satisfies` and `!` around a read no longer change the result: `(Date.now as typeof Date.now)()` and `Date.now!()` now report, and a provider such as `{ now: () => startOfToday() as Date }` passes. `no-ambient-random` treats `(Math.random as () => number)()` the same way. Projects with a `clock` owner list may see new errors.
- 316e3af: `no-env-access` reports more environment reads outside the `env` owners: `env` imported from `node:process` or `process`, `env` read from those modules' default, namespace or literal dynamic import, re-exports of `env`, the default or the whole module from them, `globalThis.process.env`, `global.process.env`, `process["env"]` and `Reflect.get(process, "env")`, including with `"env" as const`. Other `node:process` imports and re-exports such as `argv`, and `window.process` or `self.process`, still pass. Projects with an `env` owner list may see new errors.

## 0.3.0

### Minor Changes

- 995fc74: Add custom rules for patterns that coding agents repeatedly produced: suppressions without a rule and reason, generic object guards, hardcoded credentials, secret fallbacks, disabled TLS verification, promises that never settle, unchecked index searches and fetch responses, import-time effects, GET forms with password fields, and tests with optional actions, uncontrolled clocks or expectations derived from production code.

  Enable native rules for legacy built-ins, fallthrough and unreachable loops, type assertion and method signature style, `@ts-expect-error` reasons, mixed-type addition, deprecated APIs as warnings, specific test matchers, and React's rules of hooks and unknown DOM properties. Projects upgrading will see new errors, and `prefer-strict-equal` can report many existing `toEqual` calls.

  `import-boundaries` now checks `require` calls, including ones made with `createRequire`, and can reject type imports with `types: true`. `no-runtime-typeof` accepts checks on values declared with a union of known types, `no-swallowed-errors` covers Effect recovery and unread `Promise.allSettled` results, and `no-fixed-test-delay` covers `Effect.sleep`. `no-module-mocking` covers `node:test` `mock.module` and `@effect/vitest`. Fewer false positives: `no-shape-in-symbol-names` accepts names imported from packages, `no-service-constructor-imports` accepts called `make*` factories, `explicit-api-states` accepts a type predicate's subject, and `no-test-timeout-overrides` accepts retries set to 0. `no-unsafe-dictionary-type` no longer overflows the stack on recursive generic aliases.

### Patch Changes

- 613fa21: Update `@oxlint/plugins` to 1.88.0.

## 0.2.0

### Minor Changes

- 463ae11: `boundaries` and the `electron` profile now need `root: import.meta.dirname`, and their globs resolve from the config file's directory like every other option. Previously they resolved from the directory Oxlint ran from, so boundaries in a root config never matched when a monorepo linted each package from its own directory. `createLintConfig` throws when `root` is missing.

  Fix the `formatConfig` type so `...formatConfig.sortImports` typechecks, and stop the React profile flagging label text nested more than two elements deep or table cells without text.
