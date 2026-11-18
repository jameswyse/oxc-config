---
"@jameswyse/oxc-config": minor
---

`wyse/require-msw-unhandled-error` supports MSW 3, which renames `onUnhandledRequest` to `onUnhandledFrame`. The rule reads the installed `msw` version and checks the key that version reads, so `server.listen({ onUnhandledFrame: "error" })` passes on MSW 3 and a leftover `onUnhandledRequest: "error"` reports. MSW 2 projects keep using `onUnhandledRequest`. When `msw` can't be resolved from the linted file, the rule expects `onUnhandledFrame`.
