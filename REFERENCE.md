# Rule reference

Rules are errors, which fail the run, unless marked as warnings. Warnings flag patterns that have legitimate uses, so they report without failing. Custom rules use the `wyse/` prefix. Each one's tests sit beside it in `src/rules` or `src/vendor/anti-slop/rules` and show exactly what it reports.

Framework profiles and project options add rules only when enabled. The [configuration guide](docs/configuration.md) explains how to turn them on.

## Base rules

Oxlint's correctness and suspicious categories are errors. Unused variables are errors unless their names start with `_`, and suppression comments that no longer suppress anything are errors too. `no-underscore-dangle` is off, so fields such as `_id` and `__typename` stay valid.

Native rules also catch legacy and error-prone built-ins: `no-var`, `no-proto`, `no-new-func`, `no-new-wrappers`, `no-array-constructor`, `no-prototype-builtins`, `prefer-object-has-own`, `prefer-rest-params`, `prefer-regex-literals`, `import/no-mutable-exports`, `oxc/no-const-enum`, and Unicorn's `new-for-builtins`, `no-instanceof-array`, `no-new-buffer`, `prefer-node-protocol`, `prefer-import-meta-properties`, `prefer-response-static-json`, `prefer-string-trim-start-end`, `prefer-array-find`, `prefer-array-flat-map` and `prefer-array-some`.

## Types and external data

Native rules: `typescript/no-explicit-any`, `no-non-null-assertion`, `no-unsafe-function-type` and `no-import-type-side-effects`. `consistent-type-assertions` allows only `as` assertions and rejects them on object and array literals, and `method-signature-style` requires property signatures such as `run: () => void`. `ban-ts-comment` rejects `@ts-ignore` and `@ts-nocheck`, and requires a reason after `--` on `@ts-expect-error`.

Type-aware checking, which is on by default, adds the `no-unsafe-*` rules, `no-unsafe-type-assertion`, `no-unnecessary-type-assertion`, `switch-exhaustiveness-check`, `prefer-reduce-type-parameter`, `restrict-plus-operands` with every mixed-type allowance turned off, and `no-unnecessary-condition`, a nursery rule in Oxlint 1.86. `typescript/no-deprecated` is a warning outside tests.

- `wyse/no-runtime-typeof` (warning): `typeof` outside a type guard. `typeof x === "undefined"` passes, as does `typeof` on a variable or parameter declared in the same file with a union type that has no `unknown` or `any` member. Turn it off in modules that validate external input.
- `wyse/no-generic-object-guard`: a named helper such as `isRecord` whose whole body proves only that a value is a non-null object, through `typeof`, `instanceof Object`, prototype or `Object.prototype.toString` checks. Guards that also check a field pass, as do inline callbacks. It also reports any guard that takes `unknown` or `any` and claims a specific type while only checking that the value exists, or always returns `true`.
- `wyse/no-hardcoded-credential`: a string containing a private key or a token in a well-known format, such as an AWS access key or a GitHub, Stripe live, Slack, Google, Anthropic or OpenAI key. Placeholders containing `example`, `fake`, `dummy`, `placeholder`, `redacted` or a run such as `abcdefgh` pass.
- `wyse/no-disabled-tls-verification`: `rejectUnauthorized: false`, or setting `NODE_TLS_REJECT_UNAUTHORIZED` to `"0"`.
- `wyse/no-secret-fallback`: a string fallback for an environment variable whose name contains `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE`, `CREDENTIAL`, `SALT`, `SIGNING` or `API_KEY`, or ends in `KEY`, such as `process.env.SESSION_SECRET ?? "dev"` or a destructuring default.
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

Native rules: `curly`, `eqeqeq`, `no-empty`, `no-useless-catch`, Oxlint's promise checks, `array-callback-return`, `no-case-declarations`, `no-constructor-return`, `no-fallthrough`, `no-loop-func`, `no-self-compare`, `no-unreachable-loop`, `no-useless-assignment` and `unicorn/error-message`. JavaScript files also get `no-throw-literal` and `prefer-promise-reject-errors`. Type-aware checking adds floating and misused promise checks, `await-thenable`, `return-await`, `only-throw-error`, `prefer-promise-reject-errors` and `use-unknown-in-catch-callback-variable`.

- `wyse/no-deep-ternary`: a ternary nested inside two others. It replaces Oxlint's nested-ternary rule, which conflicts with Oxfmt over parentheses.
- `wyse/no-swallowed-errors` (warning): a `catch` that only returns a fallback literal, a `.catch` callback or `.then` rejection callback that is empty or only returns one, and `Promise.allSettled` results that are never read. Effect's `orElseSucceed`, `orElse`, `catchAll` and `catchAllCause` count when they recover to a fallback literal or `Effect.void`. Built-in parser and filesystem-probe `try` blocks, `response.json()`, `.catch` on a promise another caller also receives, and Effect's `catchTag` all pass.
- `wyse/explicit-api-states` (warning): a boolean parameter on an exported function, exported class constructor or public method. Destructured parameters, accessors, private members, overloads, the subject of an `asserts` or `is` return type, and the final boolean of a `set*` or `update*` function pass.
- `wyse/no-unsettled-promise`: a `new Promise` executor that runs code but never calls `resolve` or `reject`, or calls them only inside an optional call such as `server?.close(resolve)`. Executors that do nothing, such as `() => {}`, pass. Test files aren't checked.
- `wyse/no-unchecked-index-search`: an `indexOf`, `lastIndexOf`, `findIndex` or `findLastIndex` result passed straight to `splice`, `toSpliced`, `with`, `at` or `slice`, where -1 counts from the end.
- `wyse/no-unchecked-fetch-response`: reading a `fetch` response body with `json()`, `text()` or a similar method without checking `ok` or `status`. A response passed to another function passes. Test files aren't checked.

## Modules, files and names

Native rules: `import/first`, `import/no-default-export`, `import/no-duplicates`, `import/no-self-import` and `import/no-unassigned-import`. `import/no-cycle` and `oxc/no-barrel-file` are warnings. Default exports are allowed in the files that tools load them from, listed in the [configuration guide](docs/configuration.md#select-framework-and-runtime-profiles).

- `wyse/no-forwarding-module` (warning): a module made only of re-exports, or one that re-exports its imports unchanged. Package entrypoints, Next.js `app` special files and `pages`, root `middleware`, `proxy` and `instrumentation` files, and modules with directives or side-effect imports pass.
- `wyse/no-import-time-effects` (warning): starting a timer, `fetch`, top-level `await`, opening a `BroadcastChannel`, `WebSocket`, `EventSource` or `Worker`, calling `addEventListener` or `listen`, or registering `process.on` handlers when a module is imported, including inside immediately invoked functions and static class members. Config files, scripts, tests, and entrypoints such as `main`, `server`, `worker` and `instrumentation` files and `bin`, `cli`, `deploy`, `tools`, `test`, `e2e` and `fixtures` directories pass.
- `wyse/no-pass-through-function` (warning): a named function whose body only calls another function with its own parameters, in order. Zero-parameter functions, method calls, type predicates and `useEffectEvent` callees pass.
- `wyse/no-generic-file-suffix`: a file named `*Contract`, `*Policy`, `policy` or `contract`, in any case style. Test and story files pass, as do header policies such as a content security policy and files that export a binding with the file's name, such as `agentPolicy.ts` exporting `AgentPolicy`.
- `wyse/no-shape-in-symbol-names`: a name containing "shape", in any letter case.

## Comments, suppressions and logging

- `wyse/no-comments`: line, block and JSDoc comments. Shebangs, JSDoc type tags in JavaScript files and tool directives pass. The directives include lint suppressions, `@ts-expect-error`, triple-slash references, `#__PURE__`, formatter and coverage ignores, bundler magic comments, and test-environment and JSX pragmas. The `allow` option adds more patterns.
- `wyse/require-suppression-reason`: an `oxlint-disable` or `eslint-disable` directive that names no rule, or gives no reason after `--`. Oxlint applies a blanket `oxlint-disable` or `oxlint-disable-line` to this rule too, so it can't report those two forms. It does report a blanket `oxlint-disable-next-line`.
- `eslint/no-console`: console calls outside config files and scripts.

## Mutation and copying

Native rules: `prefer-const`, `no-param-reassign` and `oxc/no-accumulating-spread`. Type-aware checking adds `prefer-readonly`.

- `wyse/no-array-filter-map`: adjacent `filter` and `map` passes over an array.
- `wyse/no-reduce-accumulator-copy`: copying a reducer's accumulator with `Object.assign`, `Array.from` or an array copy method.
- `wyse/no-conditional-empty-object-spread`: spreading a conditional empty object to omit fields, such as `...(id ? { id } : {})`.

## Project ownership

These rules run only once the project names its owners through the [project boundary options](docs/configuration.md#enforce-project-boundaries).

- `wyse/no-env-access` (`env`): reading `process.env` or `import.meta.env` outside the owners, config files and scripts. That includes destructuring `env`, `globalThis.process.env`, `global.process.env`, `process["env"]` and `Reflect.get(process, "env")`, including with `"env" as const`, importing `env` from `node:process` or `process`, reading `env` from those modules' default, namespace or literal dynamic import, and re-exporting `env`, the default or the whole module from them with `export { ... } from` or `export * from`. Other `node:process` imports and re-exports, such as `argv`, type-only re-exports, and a `process` property on `window` or `self` pass. It doesn't check that the owner validates what it reads.
- `wyse/import-boundaries` (`boundaries`): a value import, re-export, literal dynamic import, or `require` call, including a loader made with `createRequire` from `node:module`, that matches a `deny` glob. Type-only imports and `import("…")` types pass unless the boundary sets `types: true`. It doesn't check computed imports.
- `wyse/server-action-guard` (`serverActionGuards`): a `"use server"` action that doesn't start by awaiting a guard, and indirect or default exports from server-action modules. Non-exported helpers and test files pass.
- `wyse/no-ambient-clock` (`clock`): `Date.now()`, `Date()` and argument-less `new Date()`, including through `globalThis` or `window`. It also reports argument-less `new TZDate()` and `new TZDateMini()` and one-argument `TZDate.tz(zone)` from `@date-fns/tz`, `@date-fns/tz/date` or `@date-fns/tz/date/mini`, and calls to the date-fns helpers that read the current time: `constructNow`, the `startOf` and `endOf` helpers for today, tomorrow and yesterday, `isToday`, `isTomorrow`, `isYesterday`, `isPast`, `isFuture`, the `isThis*` helpers, `formatDistanceToNow`, `formatDistanceToNowStrict`, `isMatch`, and `isMatch` and `isMatchWithOptions` from `date-fns/fp` at the call that supplies their last curried argument. Helpers count whether they're imported by name, through a namespace, from a `date-fns/<name>` subpath or by literal dynamic import. Re-exporting one of these helpers with `export { ... } from`, or a module that contains one, such as `date-fns` or `date-fns/fp`, with `export * from`, also reports, because calls through the re-export no longer resolve to date-fns. Helpers that compare with a given date, such as `isSameDay`, partly applied `date-fns/fp` helpers, and re-exports of `TZDate`, `TZDateMini`, other date-fns helpers or types pass. Parameter defaults, uncalled `Date.now`, provider functions that only return the read, and test files pass. Parentheses, `as`, `satisfies` and `!` don't change the result, so `(Date.now as typeof Date.now)()` reports and `{ now: () => startOfToday() as Date }` passes.
- `wyse/no-ambient-random` (`random`): `Math.random()`, `crypto.randomUUID()`, and `randomUUID` or `randomInt` from `node:crypto`. The same exceptions and wrapper handling apply. `randomBytes` and `getRandomValues` pass because they generate secrets.

## Tests

These rules run on the default test globs, the `tests` paths and the Jest and Vitest profile scopes. The `vitest` and `jest` profiles add native checks for focused, disabled and conditional tests, standalone expectations, valid `expect` calls, interpolated snapshots and redundant async `expect` callbacks. They also require the specific matcher, such as `toStrictEqual` over `toEqual`, `toHaveLength`, `toContain`, and comparison or equality matchers over `toBe(true)`. The `jest` profile rejects `done` callbacks.

- `wyse/no-fixed-test-delay`: an awaited literal timer delay, Playwright's `waitForTimeout`, or `yield* Effect.sleep` with a fixed duration. Genuine timer tests need a scoped exception.
- `wyse/no-vacuous-test-assertions`: an expectation that compares two literals, or the same identifier on both sides of `toBe`, `toEqual` or `toStrictEqual`.
- `wyse/no-edit-proof-assertions`: an assertion that only proves an import exists or is a function, such as `toBeDefined` on an import, `toBeTypeOf("function")` or `toHaveProperty` on a namespace.
- `wyse/no-optional-test-action`: a statement directly in a test body that an optional call can skip, such as `button?.click()` or `await dismiss?.click()`. Hooks and callbacks inside the test pass.
- `wyse/no-derived-test-expectation` (warning): an expected value that calls a function imported from production code, such as `toBe(formatLabel(input))`, directly, through a namespace import or through a `const` such as `expected`. `.not` assertions, functions the actual value also calls, and imports from test, fixture, e2e and helper paths pass.
- `wyse/no-uncontrolled-test-clock`: `Date.now()` or argument-less `new Date()` in a test file that never calls `useFakeTimers`, `setSystemTime`, `mock.timers.enable`, `clock.install` or `clock.setFixedTime`. Fake timers set up with `apis`, `toFake` or `doNotFake` options that leave `Date` real don't count, and neither does Effect's `TestClock`, which doesn't control `Date`. Playwright and end-to-end files pass.
- `wyse/no-test-timeout-overrides` (warning): timeout and retry overrides such as `test.setTimeout`, `test.slow()`, `describe.configure`, `vi.setConfig`, `jest.setTimeout` and `jest.retryTimes`. Setting retries to 0 passes. End-to-end files under `e2e/` or named `*.e2e.*` pass.
- `wyse/companion-has-owner` (warning): a `.test`, `.spec` or `.bench` file with no matching sibling module or directory. Files with an `integration` or `e2e` segment, and files under `tests/`, `test/`, `__tests__/` or `e2e/`, pass.
- `wyse/no-module-mocking`: Vitest, Jest and `node:test` module mocking. Replace dependencies through real interfaces, or add a file-scoped exception for an external system.

## Framework profiles

- `react` adds React and React Compiler rules, `jsx-a11y` correctness and suspicious rules, `react-you-might-not-need-an-effect`, and e18e performance rules outside tests. It includes `react/rules-of-hooks` outside end-to-end and `tests` paths, `no-unknown-property`, `checked-requires-onchange-or-readonly` and `jsx-no-useless-fragment`. It also adds `wyse/no-get-password-form`: a `<form>` with a password or one-time-code input that can submit by GET. An input belongs to the form it sits inside, or to the form its `form` attribute names. The form submits by GET when its `action` is missing or a string and its `method` is missing or anything but `post` or `dialog`, or when one of its submit buttons sets `formMethod` to anything but `post` or `dialog`.
- `nextjs` adds the React rules plus Next.js rules.
- `effect` adds `wyse/no-manual-effect-error-tag` and `wyse/no-service-constructor-imports`. The second reports a project-local `make*` import used as an uncalled value, such as `yield* makeIssueService`. Calling a `make*` factory with arguments passes.
- `electron` adds a renderer import boundary and these rules:
  - `wyse/electron-no-remote-module`: `remote` from `electron`, or `@electron/remote`, by import, `require`, dynamic import or re-export.
  - `wyse/electron-secure-web-preferences`: `webPreferences` without literal `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`, or with web security disabled, insecure content, or experimental or Blink features enabled. Later keys, spreads and computed keys that override these settings are reported too. Preferences passed from a variable the rule can't resolve pass.
  - `wyse/electron-no-raw-ipc-renderer-exposure`: exposing `ipcRenderer` or its methods through `contextBridge`, forwarding renderer-chosen channels or arguments, or passing renderer callbacks straight to `on` or `once`.

## Formatting

Oxfmt formats the code. `wyse/statement-spacing` requires a blank line after the imports, around multiline blocks and declarations, and before `return`. Consecutive imports, consecutive one-line statements, and a type alias directly after the multiline declaration it derives from stay together. It's the only custom rule with an autofix.
