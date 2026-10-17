---
"@jameswyse/oxc-config": minor
---

Test rules resolve test APIs read from a module loaded with `require`, such as `const { test, mock } = require("node:test")` or `const { setTimeout } = require("node:timers/promises")`. A required module resolves as a namespace, as a dynamic import does, so calling it directly, as in `const test = require("node:test"); test(...)`, still isn't recognised the way a default import is. `no-uncontrolled-test-clock`, `no-test-timeout-overrides`, `no-fixed-test-delay` and the other rules that recognise test callbacks now see tests registered through a required API. Projects with CommonJS tests may see new errors.
