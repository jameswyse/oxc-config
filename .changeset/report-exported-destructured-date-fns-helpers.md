---
"@jameswyse/oxc-config": minor
---

`no-ambient-clock` reports a date-fns helper that reads the clock when it's exported as a name destructured from a namespace, such as `export const { isPast } = dates` or `export const { isPast: past } = require("date-fns")`, matching an exported `const` alias such as `export const check = isPast`. Destructuring now follows nested keys, so `const { default: { isPast } } = await import("date-fns")` resolves like `.default.isPast`. Other names destructured from date-fns, and properties of a helper such as `{ isPast: { name } }`, still pass. Projects with a `clock` owner list may see new errors.
