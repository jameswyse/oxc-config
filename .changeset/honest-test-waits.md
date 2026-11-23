---
"@jameswyse/oxc-config": major
---

Catch more ways tests wait, mask slowness or share state:

- `wyse/no-network-idle-wait` is a new error. It reports `waitForLoadState("networkidle")` and navigation calls such as `page.goto` whose effective `waitUntil` is `"networkidle"` (or Puppeteer's `networkidle0` and `networkidle2`), because their timing depends on the machine and background requests. Wait for the element or state the test needs with a web-first assertion instead.
- `wyse/no-mutated-imports` is a new warning. It reports tests and test helpers that change an imported module's objects, such as `settings.retries = 0`, `mailer.send = vi.fn()` or `Object.assign(env, overrides)`, which leaks into every test that shares the module. Restoring a saved original and `process` and `node:process` imports pass.
- Vitest rules recognise `vite-plus/test`, and config rules recognise `defineConfig` from `vite-plus`.

Breaking changes:

- `wyse/no-test-timeout-overrides` reports `testTimeout` and `hookTimeout` in the root `test` block of Vite and Vitest config files. Entries under `projects` and config files named like `vitest.e2e.config.ts` pass.
- `wyse/no-fixed-test-delay` reports every `waitForTimeout` call, whatever its receiver or argument, sleeps returned from a test or hook callback, and same-file sleep helpers such as `const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))`. It also runs on end-to-end files, `test` and `tests` directories and `*.fixture.*` and `*.test-utils.*` files, so `waitForTimeout` in page objects reports.
- `wyse/no-uncontrolled-test-clock` reports `performance.now()` in test files whose fake timers don't replace `performance`.
- `wyse/no-recorder-polling` covers `vi.waitUntil`.
- `wyse/no-test-timeout-overrides` and `wyse/no-test-retries` report options on every `describe` form, including a global `describe.each` table and modifiers such as `describe.skip`.

`wyse/no-comments` also allows TSDoc on interfaces and type aliases that an exported interface extends or an exported class implements, since editors show that documentation on the exported type.
