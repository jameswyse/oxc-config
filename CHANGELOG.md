# @jameswyse/oxc-config

## 2.0.2

### Patch Changes

- 7ce4158: Fix three rules that misfired or gave advice that didn't work:

  - `wyse/no-timing-unsafe-comparison` no longer treats a name ending in `sessionHash` as a secret, so `connection.sessionHash === sessionHash` passes. A password compared with its confirmation field, such as `newPassword !== values.get("confirm")`, passes too.
  - `wyse/require-service-operation-span` suggests `Stream.withSpan` for operations it can see return a Stream, names the span after the service class or tag where it can find one, and says `Effect.fn` can wrap the existing function.
  - `wyse/no-internal-return-types` no longer reports annotations that type the returned value, such as one that keeps `{ _tag: "Refused" }` a literal, types a tuple or a returned callback's parameters, or unifies several returned Effects, nor annotations on generators such as `Effect.fn.Return`. Its message now says a typed variable widens a type and `satisfies` keeps its literal types.

## 2.0.1

### Patch Changes

- afcc58a: Update `@eslint-community/regexpp` to 4.12.3.

## 2.0.0

### Major Changes

- 115b3a4: Add rules that keep tests honest and module interfaces explicit, all as errors:

  - `wyse/no-stubbed-behavior` reports mock implementations, `vi.fn(impl)`, stubbed globals, functions patched onto browser and runtime globals, hand-written `fetch` transports, fixed Playwright route responses and hand-rolled patch-and-restore. Spies that only observe pass.
  - `wyse/require-msw-unhandled-error` reports MSW servers and workers started without `onUnhandledRequest: "error"`, in any file.
  - `wyse/no-recorder-polling` reports `expect.poll`, `vi.waitFor` and Testing Library `waitFor` calls that poll spy or request-log state instead of awaiting a signal.
  - `wyse/no-test-retries` reports test, describe, hook, runner and config-file retries in every file, including setup files and end-to-end tests.
  - `wyse/test-file-suffixes` reports `.spec` and `.tests` files, fixtures not named `<subject>.fixture` and test helpers not named `<subject>.test-utils`.
  - `wyse/no-wildcard-source-exports` reports source files made public by a wildcard `exports` entry such as `"./*": "./src/*.ts"`.
  - `wyse/no-internal-return-types` reports return type annotations on functions outside a module's exported API, with a suggestion to remove them.

  Breaking changes:

  - `wyse/no-test-timeout-overrides` is now an error and reports only timeouts. Retries moved to `wyse/no-test-retries`, so overrides that mention the old rule for retries need the new name.
  - `wyse/companion-has-owner` is now an error and also reports tests that import no module directly from their own directory, or from the parent of the `test`, `tests` or `__tests__` directory they sit in.
  - `wyse/no-fixed-test-delay` also reports `scheduler.wait` and `Bun.sleep` with a fixed delay.
  - `wyse/no-module-mocking` now passes `vi.mock` and `vi.doMock` with `{ spy: true }`, and also reports module mocks reached through namespace imports and destructured helpers.
  - `wyse/no-derived-test-expectation` treats `.test-utils` modules as test support.
  - `*.e2e.test.*` and `*.e2e.spec.*` files count as end-to-end files.
  - `wyse/no-comments` now allows single-line `// WARNING:` comments and TSDoc on exported API, and more tool directives such as `nosemgrep`, source map and licence comments. Set `publicApi` to globs to limit where TSDoc may appear, or to `[]` to keep rejecting it.

## 1.2.0

### Minor Changes

- 8941301: Add three warnings to the `effect` profile, outside tests: `wyse/no-dropped-error-cause` reports error handlers that create a new error without reading the original, `wyse/no-unbounded-retry` reports retries that repeat every failure forever, and `wyse/require-service-operation-span` reports service operations that create no span, unless they opt out with `Effect.fnUntraced`. `wyse/no-swallowed-errors` now also reports Effect v4's `Effect.catch` and `Effect.catchCause` recoveries that return a fallback.

### Patch Changes

- 2389227: `wyse/no-timing-unsafe-comparison` no longer reports comparisons where either side is declared `number`, such as a counter named `suppressionToken`. Comparing numbers can't leak a secret through timing. The rule reads the type from the annotation on a variable or parameter, or on a property of an inline object type such as `{ count: number | undefined }` or `Readonly<{ count: number }>`, including a property destructured from a parameter. Named types, inferred types and casts such as `as number`, whether on the compared value or in a value written to its binding or one of its properties, still count as unknown, so those comparisons are still reported.
- 5566513: Custom rules that look up where a variable is declared, such as `wyse/no-dynamic-shell-command` and `wyse/no-module-mocking`, now find the same declaration JavaScript uses. In a parameter default such as `(start = () => exec(status))`, `status` now resolves to the declaration outside the function, not a same-named declaration in the function body. A type-only declaration such as `type Date = string` no longer hides the global value of the same name, so `wyse/no-ambient-clock` now reports `Date.now()` beside it. Before, these rules could trust the wrong declaration and miss a report.

## 1.1.1

### Patch Changes

- 294495f: Fix edge cases in the security rules added in 1.1.0:

  - `wyse/no-dynamic-regex`, `wyse/no-dynamic-shell-command` and `wyse/no-exponential-regex` no longer slow linting down, or run out of memory, on chains of `const` strings that each reuse an earlier one, such as `const b = a + a`. They skip strings that templates, concatenation or `const` strings build into more than 65,536 characters or 512 parts.
  - `wyse/no-dynamic-shell-command` no longer trusts an argument array held in a `const` that is exported, passed to another function or changed after it's created, and no longer reads an options object whose properties are assigned or deleted after it's created.
  - `wyse/no-exponential-regex` applies flags set on a group, such as `(?i:a|A)+`, and no longer reports repeated groups whose alternatives only assert a position, such as `(?:^|^)*`.

## 1.1.0

### Minor Changes

- 67d7d8d: Add security rules, so projects can drop `eslint-plugin-security`. The `security` profile, which `createLintConfig` always applies, now reports:

  - Unicode bidirectional control characters anywhere in a file, which can make code display differently from how it runs (`wyse/no-bidi-control-characters`).
  - `child_process` `exec` and `execSync` commands built at run time, and `spawn`, `spawnSync`, `execFile` and `execFileSync` calls that turn on `shell` with a command or arguments built at run time (`wyse/no-dynamic-shell-command`). Test files aren't checked.
  - Regular expressions that can take exponential time to fail a match, such as `/(a+)+$/` and `/(.|\s)*$/` (`wyse/no-exponential-regex`).
  - `new RegExp(x)` and `RegExp(x)` patterns built at run time, unless every value in them is escaped with `RegExp.escape` or an `escapeRegExp`-style helper (`wyse/no-dynamic-regex`).
  - `===`, `!==`, `==` and `!=` comparisons of values named like a password, secret, token, API key, hash, signature or digest, which can leak the secret through timing. Use `crypto.timingSafeEqual` instead (`wyse/no-timing-unsafe-comparison`). Test files aren't checked.
  - `require` calls with a module name built at run time (`import/no-dynamic-require`).

  Rules the presets already enable cover the rest of `eslint-plugin-security` that's worth keeping: `no-eval`, `no-implied-eval`, `no-new-func`, `unicorn/no-new-buffer` and, with type-aware checking, `typescript/no-implied-eval` and `typescript/no-deprecated`. The [rule reference](https://github.com/jameswyse/oxc-config/blob/main/REFERENCE.md#security) lists exactly what each new rule reports.

## 1.0.0

### Major Changes

- d3764c4: Add presets, so a team can publish its own configs built from this package's rules. `@jameswyse/oxc-config/oxlint/preset` exports `defineLintPreset`, `extendProfile` and the profile types, `@jameswyse/oxc-config/oxlint/profiles` exports the rule profiles that `createLintConfig` is now built from, and `@jameswyse/oxc-config/oxfmt/preset` exports `defineFormatPreset`. The new [preset guide](https://github.com/jameswyse/oxc-config/blob/main/docs/presets.md) shows how to build one.

  `createLintConfig` takes `rules`, `overrides` and `ignorePatterns` options. `rules` changes a rule wherever the config sets it, so rules set for some files, such as the type-aware and test rules, can be changed without writing an override. `overrides` and `ignorePatterns` are added to the shared ones. Spreading the returned config still works, and the lint rules each option enables are unchanged.

  Breaking changes:

  - `formatConfig` is replaced by `createFormatConfig`. Change `export default formatConfig` to `export default createFormatConfig()`, and pass changes as options instead of spreading. `sortImports` options merge into the shared import sorting and `ignorePatterns` are added to the shared ones.
  - The `FileScope` type is `true | string[]` and no longer includes `false`. Profile options still accept `false`.

## 0.7.0

### Minor Changes

- d08266c: Update `eslint-plugin-react-you-might-not-need-an-effect` to 1.1.0. The `react` profile's effect rules now recognise hooks imported under another name, such as `import { useEffect as useE } from "react"`, called through a default or namespace import with any name, such as `R.useState`, or imported from `preact/hooks`, `preact/compat` or `@wordpress/element`. Previously only bare `useState`, `useRef` and `useEffect` calls and `React.<hook>` were checked. Projects with the `react` profile may see new errors.

## 0.6.2

### Patch Changes

- 64d7525: Update `eslint-plugin-react-you-might-not-need-an-effect` to 1.0.3.

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
