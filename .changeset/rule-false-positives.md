---
"@jameswyse/oxc-config": patch
---

Fix three rules that misfired or gave advice that didn't work:

- `wyse/no-timing-unsafe-comparison` no longer reports hashes other than `passwordHash`, such as `connection.sessionHash === sessionHash`, or comparisons with a confirmation field, such as `newPassword !== values.get("confirm")`. It now reports names ending in `hmac`.
- `wyse/require-service-operation-span` suggests `Stream.withSpan` for operations that return a Stream, names the span after the service class or tag instead of the literal `Service`, and says `Effect.fn` can wrap the existing function.
- `wyse/no-internal-return-types` no longer reports annotations that type the returned value, such as one that keeps `{ _tag: "Refused" }` a literal, a tuple, a returned callback's parameters, or a union of two Effects, nor annotations on generators such as `Effect.fn.Return`. Applying its suggestion no longer breaks typechecking in those cases.
