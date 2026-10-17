---
"@jameswyse/oxc-config": minor
---

`no-env-access` reports `env` read from `require("node:process")` or `require("process")`, whether `require` is Node's own or a loader made with `createRequire` from `node:module` or `module`, stored as in `const require = createRequire(import.meta.url)`, copied to another `const` or called directly as in `createRequire(import.meta.url)("node:process").env`. Destructuring, aliases, computed keys and `Reflect.get` apply as they do to an imported `process`, and a `require` function the file defines itself, or a loader variable that's reassigned, still passes. `import-boundaries` now also checks a directly called `createRequire(import.meta.url)("…")` and a `const` copy of a loader, and no longer treats a function destructured from a `createRequire` loader, such as `resolve`, or a reassigned loader variable as `require`. Projects with an `env` owner list may see new errors.
