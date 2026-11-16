# Rule reference

Rules are errors, which fail the run, unless marked as warnings. Warnings flag patterns that have legitimate uses, so they report without failing. Custom rules use the `wyse/` prefix. Each one's tests sit beside it in `src/rules` or `src/vendor/anti-slop/rules` and show exactly what it reports.

Framework profiles and project options add rules only when enabled. The [configuration guide](docs/configuration.md) explains how to turn them on.

Each section names the profile that holds its rules. `createLintConfig` always applies the `core`, `types`, `security`, `errors`, `modules`, `comments`, `mutation`, `tests` and `spacing` profiles. A [preset](docs/presets.md) chooses its own.

## Base rules

Profile: `core`.

Oxlint's correctness and suspicious categories are errors. Unused variables are errors unless their names start with `_`, and suppression comments that no longer suppress anything are errors too. `no-underscore-dangle` is off, so fields such as `_id` and `__typename` stay valid.

Native rules also catch legacy and error-prone built-ins: `no-var`, `no-proto`, `no-new-func`, `no-new-wrappers`, `no-array-constructor`, `no-prototype-builtins`, `prefer-object-has-own`, `prefer-rest-params`, `prefer-regex-literals`, `import/no-mutable-exports`, `oxc/no-const-enum`, and Unicorn's `new-for-builtins`, `no-instanceof-array`, `no-new-buffer`, `prefer-node-protocol`, `prefer-import-meta-properties`, `prefer-response-static-json`, `prefer-string-trim-start-end`, `prefer-array-find`, `prefer-array-flat-map` and `prefer-array-some`.

## Types and external data

Profile: `types`.

Native rules: `typescript/no-explicit-any`, `no-non-null-assertion`, `no-unsafe-function-type` and `no-import-type-side-effects`. `consistent-type-assertions` allows only `as` assertions and rejects them on object and array literals, and `method-signature-style` requires property signatures such as `run: () => void`. `ban-ts-comment` rejects `@ts-ignore` and `@ts-nocheck`, and requires a reason after `--` on `@ts-expect-error`.

Type-aware checking, which is on by default, adds the `no-unsafe-*` rules, `no-unsafe-type-assertion`, `no-unnecessary-type-assertion`, `switch-exhaustiveness-check`, `prefer-reduce-type-parameter`, `restrict-plus-operands` with every mixed-type allowance turned off, and `no-unnecessary-condition`, a nursery rule in Oxlint 1.86. `typescript/no-deprecated` is a warning outside tests.

- `wyse/no-runtime-typeof` (warning): `typeof` outside a type guard. `typeof x === "undefined"` passes, as does `typeof` on a variable or parameter declared in the same file with a union type that has no `unknown` or `any` member. Turn it off in modules that validate external input.
- `wyse/no-generic-object-guard`: a named helper such as `isRecord` whose whole body proves only that a value is a non-null object, through `typeof`, `instanceof Object`, prototype or `Object.prototype.toString` checks. Guards that also check a field pass, as do inline callbacks. It also reports any guard that takes `unknown` or `any` and claims a specific type while only checking that the value exists, or always returns `true`.
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

## Security

Profile: `security`.

Native rules: `import/no-dynamic-require`.

- `wyse/no-hardcoded-credential`: a string containing a private key or a token in a well-known format, such as an AWS access key or a GitHub, Stripe live, Slack, Google, Anthropic or OpenAI key. Placeholders containing `example`, `fake`, `dummy`, `placeholder`, `redacted` or a run such as `abcdefgh` pass.
- `wyse/no-disabled-tls-verification`: `rejectUnauthorized: false`, or setting `NODE_TLS_REJECT_UNAUTHORIZED` to `"0"`.
- `wyse/no-secret-fallback`: a string fallback for an environment variable whose name contains `SECRET`, `TOKEN`, `PASSWORD`, `PRIVATE`, `CREDENTIAL`, `SALT`, `SIGNING` or `API_KEY`, or ends in `KEY`, such as `process.env.SESSION_SECRET ?? "dev"` or a destructuring default.
- `wyse/no-bidi-control-characters`: a Unicode bidirectional control character, U+202A to U+202E or U+2066 to U+2069, anywhere in a file, including comments and strings. These Trojan Source characters make code display differently from how it runs. Escapes such as `"\u202E"` pass.
- `wyse/no-dynamic-shell-command`: a `child_process` `exec` or `execSync` call, including one wrapped in `util.promisify`, whose command is built at run time. Commands made of string literals, templates, `String.raw` and `const` strings with no run-time values pass. `spawn`, `spawnSync`, `execFile` and `execFileSync` are reported only when an inline options object sets `shell` to `true` or a shell path and the command or an argument is built at run time. An argument array held in a `const` counts as fixed when the module only reads it or passes it to `child_process` calls. An array that is exported, passed to another function or changed after it's created counts as built at run time. An options object held in a `const` is read unless a property is assigned or deleted after it's created, or a method is called on it. Commands that templates, concatenation or `const` strings build into more than 65,536 characters or 512 parts aren't analysed. Test and end-to-end files aren't checked.
- `wyse/no-exponential-regex`: a regex literal or `new RegExp(...)` pattern, including one built from `const` strings, that can backtrack exponentially when a match fails. Under an unbounded quantifier such as `*`, `+` or `{2,}` that something matched after it can fail, which inside a lookbehind means something earlier in the source, it reports a nested quantifier that can repeat a varying number of times while everything beside it can match nothing, such as `^(a+)+$` or `^(\w+\s?)*$`, and alternatives of characters, character classes and fixed-count quantifiers up to `{16}`, such as `a{2}`, that can split the same input more than one way, such as `(.|\s)*$`, `(a|aa)+$` or `(ab|a|ba)+$`. Flags set on a group, such as `(?i:...)`, apply inside it. Case-insensitive matching is modelled for ASCII letters only. It doesn't report a quantifier at the end of the pattern, such as `(a+)+`, since nothing after it can fail, polynomial backtracking such as `\s*\s*$`, alternatives that contain variable quantifiers or Unicode property escapes, nesting under a bounded quantifier such as `(a+){1,10}`, or patterns with run-time values, which `wyse/no-dynamic-regex` covers.
- `wyse/no-dynamic-regex`: `new RegExp(x)` or `RegExp(x)` whose pattern is built at run time. Patterns made of string literals, templates, `String.raw`, concatenation and `const` strings pass when every run-time value in them is escaped. A value counts as escaped when it is passed through `RegExp.escape` or a helper named `escapeRegExp`, `escapeRegex` or `escapeStringRegexp` in any letter case, such as Lodash's or the `escape-string-regexp` package's, or is a `values.map(escapeRegExp).join("|")` list of escaped values. To change a regex's flags, pass the regex itself, as in `new RegExp(pattern, "g")`. Patterns that templates, concatenation or `const` strings build into more than 65,536 characters or 512 parts aren't analysed by this rule or `wyse/no-exponential-regex`.
- `wyse/no-timing-unsafe-comparison`: `===`, `!==`, `==` or `!=` where one side is a variable or property, including through optional chaining, whose name ends with the word `password`, `secret`, `token`, `hash`, `signature`, `digest` or `apiKey`, or with `key` after one of those words, in camelCase, snake_case or constant case. Examples include `signature !== expected`, `user.passwordHash === input` and `SECRET_KEY === provided`. Names that only contain one of these words, such as `tokenCount` or `hashtag`, and PascalCase names such as the enum member `AuthType.Password` pass. Comparisons with `null`, `undefined`, a boolean, a number, an empty string or a `typeof` check pass too, as do comparisons where either side is declared `number`, optionally in a union with `null` or `undefined`. The rule reads that type from the annotation on a variable or parameter, or on a property of an inline object type such as `{ count: number }` or `Readonly<{ count: number }>`, including a property destructured from a parameter. A cast such as `as number` counts as unknown, even on a value declared `number`, because TypeScript erases it without checking the value, so `(input as number) === token` is still reported. A binding counts as unknown too when a value containing a cast is ever written to it or to one of its properties, such as `const token: number = input as number` or `session.token = input as number`. The rule can't follow values typed `any`, other variables that share the object, or helper functions, so `const token: number = JSON.parse(raw)` still counts as a number. Types it can't see in the annotation, such as named types and inferred types, count as unknown, so those comparisons are still reported. Test and end-to-end files aren't checked.

## Control flow and errors

Profile: `errors`.

Native rules: `curly`, `eqeqeq`, `no-empty`, `no-useless-catch`, Oxlint's promise checks, `array-callback-return`, `no-case-declarations`, `no-constructor-return`, `no-fallthrough`, `no-loop-func`, `no-self-compare`, `no-unreachable-loop`, `no-useless-assignment` and `unicorn/error-message`. JavaScript files also get `no-throw-literal` and `prefer-promise-reject-errors`. Type-aware checking adds floating and misused promise checks, `await-thenable`, `return-await`, `only-throw-error`, `prefer-promise-reject-errors` and `use-unknown-in-catch-callback-variable`.

- `wyse/no-deep-ternary`: a ternary nested inside two others. It replaces Oxlint's nested-ternary rule, which conflicts with Oxfmt over parentheses.
- `wyse/no-swallowed-errors` (warning): a `catch` that only returns a fallback literal, a `.catch` callback or `.then` rejection callback that is empty or only returns one, and `Promise.allSettled` results that are never read. Effect's `orElseSucceed`, `orElse`, `catch`, `catchAll`, `catchCause` and `catchAllCause` count when they recover to a fallback literal or `Effect.void`. Built-in parser and filesystem-probe `try` blocks, `response.json()`, `.catch` on a promise another caller also receives, and Effect's `catchTag` all pass.
- `wyse/explicit-api-states` (warning): a boolean parameter on an exported function, exported class constructor or public method. Destructured parameters, accessors, private members, overloads, the subject of an `asserts` or `is` return type, and the final boolean of a `set*` or `update*` function pass.
- `wyse/no-unsettled-promise`: a `new Promise` executor that runs code but never calls `resolve` or `reject`, or calls them only inside an optional call such as `server?.close(resolve)`. Executors that do nothing, such as `() => {}`, pass. Test files aren't checked.
- `wyse/no-unchecked-index-search`: an `indexOf`, `lastIndexOf`, `findIndex` or `findLastIndex` result passed straight to `splice`, `toSpliced`, `with`, `at` or `slice`, where -1 counts from the end.
- `wyse/no-unchecked-fetch-response`: reading a `fetch` response body with `json()`, `text()` or a similar method without checking `ok` or `status`. A response passed to another function passes. Test files aren't checked.

## Modules, files and names

Profile: `modules`.

Native rules: `import/first`, `import/no-default-export`, `import/no-duplicates`, `import/no-self-import` and `import/no-unassigned-import`. `import/no-cycle` and `oxc/no-barrel-file` are warnings. Default exports are allowed in the files that tools load them from, listed in the [configuration guide](docs/configuration.md#select-framework-and-runtime-profiles).

- `wyse/no-forwarding-module` (warning): a module made only of re-exports, or one that re-exports its imports unchanged. Package entrypoints, Next.js `app` special files and `pages`, root `middleware`, `proxy` and `instrumentation` files, and modules with directives or side-effect imports pass.
- `wyse/no-import-time-effects` (warning): starting a timer, `fetch`, top-level `await`, opening a `BroadcastChannel`, `WebSocket`, `EventSource` or `Worker`, calling `addEventListener` or `listen`, or registering `process.on` handlers when a module is imported, including inside immediately invoked functions and static class members. Config files, scripts, tests, and entrypoints such as `main`, `server`, `worker` and `instrumentation` files and `bin`, `cli`, `deploy`, `tools`, `test`, `e2e` and `fixtures` directories pass.
- `wyse/no-pass-through-function` (warning): a named function whose body only calls another function with its own parameters, in order. Zero-parameter functions, method calls, type predicates and `useEffectEvent` callees pass.
- `wyse/no-generic-file-suffix`: a file named `*Contract`, `*Policy`, `policy` or `contract`, in any case style. Test and story files pass, as do header policies such as a content security policy and files that export a binding with the file's name, such as `agentPolicy.ts` exporting `AgentPolicy`.
- `wyse/no-shape-in-symbol-names`: a name containing "shape", in any letter case.

## Comments, suppressions and logging

Profile: `comments`.

- `wyse/no-comments`: line, block and JSDoc comments. Shebangs, JSDoc type tags in JavaScript files and tool directives pass. The directives include lint suppressions, `@ts-expect-error`, triple-slash references, `#__PURE__`, formatter and coverage ignores, bundler magic comments, and test-environment and JSX pragmas. The `allow` option adds more patterns.
- `wyse/require-suppression-reason`: an `oxlint-disable` or `eslint-disable` directive that names no rule, or gives no reason after `--`. Oxlint applies a blanket `oxlint-disable` or `oxlint-disable-line` to this rule too, so it can't report those two forms. It does report a blanket `oxlint-disable-next-line`.
- `eslint/no-console`: console calls outside config files and scripts.

## Mutation and copying

Profile: `mutation`.

Native rules: `prefer-const`, `no-param-reassign` and `oxc/no-accumulating-spread`. Type-aware checking adds `prefer-readonly`.

- `wyse/no-array-filter-map`: adjacent `filter` and `map` passes over an array.
- `wyse/no-reduce-accumulator-copy`: copying a reducer's accumulator with `Object.assign`, `Array.from` or an array copy method.
- `wyse/no-conditional-empty-object-spread`: spreading a conditional empty object to omit fields, such as `...(id ? { id } : {})`.

## Project ownership

Each rule has a profile named after its option, shown in brackets. These rules run only once the project names its owners through the [project boundary options](docs/configuration.md#enforce-project-boundaries).

- `wyse/no-env-access` (`env`): reading `process.env` or `import.meta.env` outside the owners, config files and scripts. That includes `globalThis.process.env`, `global.process.env`, `process["env"]` and `Reflect.get(process, "env")`, including with `"env" as const`, importing `env` from `node:process` or `process`, reading `env` from those modules' default, namespace, literal dynamic import or `require`, including through a loader made with `createRequire` from `node:module` or `module` or a `const` copy of a loader, and re-exporting `env`, the default or the whole module from them with `export { ... } from` or `export * from`. Destructuring `env` from any of these counts in a declaration, a parameter default such as `({ env } = process) => env`, or an assignment. Destructuring `env` through a namespace's `default`, such as `({ default: { env } } = p)`, or into a rest element, such as `({ ...rest } = process)`, isn't followed. Other `node:process` imports and re-exports, such as `argv`, type-only re-exports, a `require` function the file defines itself, a loader variable that's reassigned, and a `process` property on `window` or `self` pass. It doesn't check that the owner validates what it reads.
- `wyse/import-boundaries` (`boundaries`): a value import, re-export, literal dynamic import, or `require` call, including a loader made with `createRequire` from `node:module` or `module`, whether stored, copied to another `const` or called directly as `createRequire(import.meta.url)("…")`, that matches a `deny` glob. A loader variable that's reassigned doesn't count. Type-only imports and `import("…")` types pass unless the boundary sets `types: true`. It doesn't check computed imports.
- `wyse/server-action-guard` (`serverActionGuards`): a `"use server"` action that doesn't start by awaiting a guard, and indirect or default exports from server-action modules. Non-exported helpers and test files pass.
- `wyse/no-ambient-clock` (`clock`): `Date.now()`, `Date()` and argument-less `new Date()`, including through `globalThis` or `window`. It also reports argument-less `new TZDate()` and `new TZDateMini()` and one-argument `TZDate.tz(zone)` from `@date-fns/tz`, `@date-fns/tz/date` or `@date-fns/tz/date/mini`, and the date-fns helpers that read the current time: `constructNow`, the `startOf` and `endOf` helpers for today, tomorrow and yesterday, `isToday`, `isTomorrow`, `isYesterday`, `isPast`, `isFuture`, the `isThis*` helpers, `formatDistanceToNow`, `formatDistanceToNowStrict`, `isMatch`, and `isMatch` and `isMatchWithOptions` from `date-fns/fp`. A helper reports where it's called, where it's passed or stored uncalled, such as `dates.filter(isPast)` or `{ check: isToday }`, and where it's exported by local name, such as `export { isPast }`. A `date-fns/fp` helper reports once at the end of its call chain, so the partial application in `values.filter(isMatch("yyyy"))` reports too. A `const` alias reports where it's used, and an exported one where it's declared, including a name destructured from a namespace, such as `export const { isPast } = dates`. Helpers count whether they're imported by name, through a namespace, from a `date-fns/<name>` subpath, by literal dynamic import or by `require`. Re-exporting one of these helpers with `export { ... } from`, or a module that contains one, such as `date-fns` or `date-fns/fp`, with `export * from`, also reports, because calls through the re-export no longer resolve to date-fns. Helpers that compare with a given date, such as `isSameDay`, type positions such as `typeof isPast`, type-only imports and exports, and re-exports of `TZDate`, `TZDateMini`, other date-fns helpers or types pass. Parameter defaults, such as `check = isPast`, uncalled `Date.now`, provider functions that only return the read, including through `.call`, `.apply` or `.bind`, write-only uses of a helper's name on a module object, such as `d.isPast = check`, `[d.isPast] = values`, `for (d.isPast of values)`, `delete d.isPast` and `delete d?.isPast`, and test files pass. Parentheses, `as`, `satisfies` and `!` don't change the result, so `(Date.now as typeof Date.now)()` reports and `{ now: () => startOfToday() as Date }` passes.
- `wyse/no-ambient-random` (`random`): `Math.random()`, `crypto.randomUUID()`, and `randomUUID` or `randomInt` from `node:crypto`. The same exceptions and wrapper handling apply. `randomBytes` and `getRandomValues` pass because they generate secrets.

## Tests

Profiles: `tests`, `vitest` and `jest`.

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
- `effect` adds `wyse/no-manual-effect-error-tag` and `wyse/no-service-constructor-imports`. The second reports a project-local `make*` import used as an uncalled value, such as `yield* makeIssueService`. Calling a `make*` factory with arguments passes. Outside tests, it also adds three warnings:
  - `wyse/no-dropped-error-cause` (warning): an `Effect.mapError` or `mapErrorEager` handler that returns a new error, or an `Effect.catch`, `catchAll`, `catchAllCause`, `catchCause`, `catchCauseFilter`, `catchCauseIf`, `catchEager`, `catchFilter` or `catchIf` handler that fails with one, without reading the original error. Every return in the handler counts. Handlers that read the error or recover with a value pass, as do handlers directly after an `Effect.tapError`, `tapErrorCause` or `tapCause` step that reads the error, which logs it before it is replaced. `catchTag` and `catchTags` handlers pass too, because translating one domain error into another rarely loses anything.
  - `wyse/no-unbounded-retry` (warning): `Effect.retry` or `Effect.retryOrElse` with a schedule built only from schedules that never stop, such as `Schedule.forever`, `Schedule.spaced` or `Schedule.exponential`, and delay adjustments such as `Schedule.jittered`, or with options that have neither `times`, `while` nor `until`. It follows `const` schedules and options in the same file. Schedules that can stop, such as those using `Schedule.recurs`, `during`, `upTo` or `while`, pass, as do schedules the rule can't see, such as imported ones, and retries followed by a timeout in the same pipe or wrapped in one.
  - `wyse/require-service-operation-span` (warning): a service operation that has no span. The operations are the members of the object a `Layer.effect` or `Layer.scoped` generator returns, or the object `Layer.succeed` receives or `Layer.sync` returns, directly or through `Service.of`. A member defined with an unnamed `Effect.fn` reports, because only a named one adds a span. Members defined with a named `Effect.fn` or with `Effect.fnUntraced`, functions whose own body uses `Effect.withSpan` or `Stream.withSpan` or calls a same-file function that does, `async` functions, and members that aren't functions pass. Spans inside nested callbacks don't count, apart from those in an `Effect.gen` body the operation runs.
- `electron` adds a renderer import boundary and these rules:
  - `wyse/electron-no-remote-module`: `remote` from `electron`, or `@electron/remote`, by import, `require`, dynamic import or re-export.
  - `wyse/electron-secure-web-preferences`: `webPreferences` without literal `contextIsolation: true`, `sandbox: true` and `nodeIntegration: false`, or with web security disabled, insecure content, or experimental or Blink features enabled. Later keys, spreads and computed keys that override these settings are reported too. Preferences passed from a variable the rule can't resolve pass.
  - `wyse/electron-no-raw-ipc-renderer-exposure`: exposing `ipcRenderer` or its methods through `contextBridge`, forwarding renderer-chosen channels or arguments, or passing renderer callbacks straight to `on` or `once`.

## Formatting

Profile: `spacing`.

Oxfmt formats the code. `wyse/statement-spacing` requires a blank line after the imports, around multiline blocks and declarations, and before `return`. Consecutive imports, consecutive one-line statements, and a type alias directly after the multiline declaration it derives from stay together. It's the only custom rule with an autofix.
