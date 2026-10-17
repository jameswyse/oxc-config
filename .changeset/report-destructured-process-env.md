---
"@jameswyse/oxc-config": minor
---

`no-env-access` reports `env` destructured from `process` in a parameter default or a destructuring assignment, not only in a variable declaration, such as `({ env } = process) => env.PORT`, `function read({ env: e } = process)`, a method parameter, or `({ env } = process);`. This covers renamed, nested and computed-literal keys, and the global `process`, `globalThis.process`, `import.meta`, the default or namespace import of `node:process` or `process`, and a required `process`. Projects with an `env` owner list may see new errors.
