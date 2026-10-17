---
"@jameswyse/oxc-config": minor
---

`no-env-access` reports `env` read from `require("node:process")` or `require("process")`, whether `require` is Node's own or a loader made with `createRequire` from `node:module` or `module`, stored as in `const require = createRequire(import.meta.url)` or called directly as in `createRequire(import.meta.url)("node:process").env`. Destructuring, aliases, computed keys and `Reflect.get` apply as they do to an imported `process`, and a `require` function the file defines itself still passes. `import-boundaries` now also checks a directly called `createRequire(import.meta.url)("…")`, and no longer treats a function destructured from a `createRequire` loader, such as `resolve`, as `require`. Projects with an `env` owner list may see new errors.
