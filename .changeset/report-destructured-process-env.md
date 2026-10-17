---
"@jameswyse/oxc-config": minor
---

`no-env-access` reports `env` destructured from `process` in a parameter default or a destructuring assignment, not only in a variable declaration, such as `({ env } = process) => env.PORT`, `function read({ env: e } = process)`, a method parameter, or `({ env } = process);`. This covers renamed and computed-literal keys, a pattern nested under `env` such as `({ env: { PORT } } = process)`, and the global `process`, `globalThis.process`, `import.meta`, the default or namespace import of `node:process` or `process`, and a required `process`. Destructuring `env` through a namespace's `default`, such as `({ default: { env } } = p)`, and a rest element such as `({ ...rest } = process)` still pass. Projects with an `env` owner list may see new errors.
