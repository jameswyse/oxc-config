---
"@jameswyse/oxc-config": patch
---

Depend on `@oxlint/plugins` `>=1.86.0 <2`, the same range as the `oxlint` peer, instead of exactly 1.88.0, so a project can update `@oxlint/plugins` to the newest 1.x without waiting for a new release of this package.
