---
"@jameswyse/oxc-config": minor
---

Add custom rules for patterns that coding agents repeatedly produced: suppressions without a rule and reason, generic object guards, hardcoded credentials, secret fallbacks, disabled TLS verification, promises that never settle, unchecked index searches and fetch responses, import-time effects, GET forms with password fields, and tests with optional actions, uncontrolled clocks or expectations derived from production code.

Enable native rules for legacy built-ins, fallthrough and unreachable loops, type assertion and method signature style, `@ts-expect-error` reasons, mixed-type addition, deprecated APIs as warnings, specific test matchers, and React's rules of hooks and unknown DOM properties. Projects upgrading will see new errors, and `prefer-strict-equal` can report many existing `toEqual` calls.

`import-boundaries` now checks `require` calls, including ones made with `createRequire`, and can reject type imports with `types: true`. `no-runtime-typeof` accepts checks on values declared with a union of known types, `no-swallowed-errors` covers Effect recovery and unread `Promise.allSettled` results, and `no-fixed-test-delay` covers `Effect.sleep`. `no-module-mocking` covers `node:test` `mock.module` and `@effect/vitest`. Fewer false positives: `no-shape-in-symbol-names` accepts names imported from packages, `no-service-constructor-imports` accepts called `make*` factories, `explicit-api-states` accepts a type predicate's subject, and `no-test-timeout-overrides` accepts retries set to 0. `no-unsafe-dictionary-type` no longer overflows the stack on recursive generic aliases.
