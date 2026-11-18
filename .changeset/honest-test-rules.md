---
"@jameswyse/oxc-config": major
---

Add rules that keep tests honest and module interfaces explicit, all as errors:

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
