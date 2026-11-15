---
"@jameswyse/oxc-config": minor
---

Add security rules, so projects can drop `eslint-plugin-security`. The `security` profile, which `createLintConfig` always applies, now reports:

- Unicode bidirectional control characters anywhere in a file, which can make code display differently from how it runs (`wyse/no-bidi-control-characters`).
- `child_process` `exec` and `execSync` commands built at run time, and `spawn`, `spawnSync`, `execFile` and `execFileSync` calls that turn on `shell` with a command or arguments built at run time (`wyse/no-dynamic-shell-command`). Test files aren't checked.
- Regular expressions that can take exponential time to fail a match, such as `/(a+)+$/` and `/(.|\s)*$/` (`wyse/no-exponential-regex`).
- `new RegExp(x)` and `RegExp(x)` patterns built at run time, unless every value in them is escaped with `RegExp.escape` or an `escapeRegExp`-style helper (`wyse/no-dynamic-regex`).
- `===`, `!==`, `==` and `!=` comparisons of values named like a password, secret, token, API key, hash, signature or digest, which can leak the secret through timing. Use `crypto.timingSafeEqual` instead (`wyse/no-timing-unsafe-comparison`). Test files aren't checked.
- `require` calls with a module name built at run time (`import/no-dynamic-require`).

Rules the presets already enable cover the rest of `eslint-plugin-security` that's worth keeping: `no-eval`, `no-implied-eval`, `no-new-func`, `unicorn/no-new-buffer` and, with type-aware checking, `typescript/no-implied-eval` and `typescript/no-deprecated`. The [rule reference](https://github.com/jameswyse/oxc-config/blob/main/REFERENCE.md#security) lists exactly what each new rule reports.
