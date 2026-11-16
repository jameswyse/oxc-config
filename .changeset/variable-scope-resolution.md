---
"@jameswyse/oxc-config": patch
---

Custom rules that look up where a variable is declared, such as `wyse/no-dynamic-shell-command` and `wyse/no-module-mocking`, now find the same declaration JavaScript uses. In a parameter default such as `(start = () => exec(status))`, `status` now resolves to the declaration outside the function, not a same-named declaration in the function body. A type-only declaration such as `type Date = string` no longer hides the global value of the same name, so `wyse/no-ambient-clock` now reports `Date.now()` beside it. Before, these rules could trust the wrong declaration and miss a report.
