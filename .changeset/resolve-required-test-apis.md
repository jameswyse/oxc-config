---
"@jameswyse/oxc-config": minor
---

Test rules resolve test APIs loaded with `require` as they do imported ones, such as `const { test, mock } = require("node:test")` or `const { setTimeout } = require("node:timers/promises")`. `no-uncontrolled-test-clock`, `no-test-timeout-overrides`, `no-fixed-test-delay` and the other rules that recognise test callbacks now see tests registered through a required API. Projects with CommonJS tests may see new errors.
