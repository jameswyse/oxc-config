---
"@jameswyse/oxc-config": patch
---

Fix edge cases in the security rules added in 1.1.0:

- `wyse/no-dynamic-regex`, `wyse/no-dynamic-shell-command` and `wyse/no-exponential-regex` no longer slow linting down, or run out of memory, on chains of `const` strings that each reuse an earlier one, such as `const b = a + a`. They skip strings that templates, concatenation or `const` strings build into more than 65,536 characters or 512 parts.
- `wyse/no-dynamic-shell-command` no longer trusts an argument array held in a `const` that is passed to another function or changed after it's created, and no longer reads an options object whose properties are assigned or deleted after it's created.
- `wyse/no-exponential-regex` applies flags set on a group, such as `(?i:a|A)+`, and no longer reports repeated groups whose alternatives only assert a position, such as `(?:^|^)*`.
