---
"@jameswyse/oxc-config": minor
---

`no-env-access` reports more environment reads outside the `env` owners: `env` imported from `node:process` or `process`, `env` read from those modules' default, namespace or literal dynamic import, `globalThis.process.env`, `global.process.env`, `process["env"]` and `Reflect.get(process, "env")`. Other `node:process` imports such as `argv`, and `window.process` or `self.process`, still pass. Projects with an `env` owner list may see new errors.
