---
"@jameswyse/oxc-config": patch
---

Fix three rules that misfired or gave advice that didn't work:

- `wyse/no-timing-unsafe-comparison` no longer treats a name ending in `sessionHash` as a secret, so `connection.sessionHash === sessionHash` passes. A password compared with its confirmation field, such as `newPassword !== values.get("confirm")`, passes too.
- `wyse/require-service-operation-span` suggests `Stream.withSpan` for operations it can see return a Stream, names the span after the service class or tag where it can find one, and says `Effect.fn` can wrap the existing function.
- `wyse/no-internal-return-types` no longer reports annotations that type the returned value, such as one that keeps `{ _tag: "Refused" }` a literal, types a tuple or a returned callback's parameters, or unifies several returned Effects, nor annotations on generators such as `Effect.fn.Return`. Its message now says a typed variable widens a type and `satisfies` keeps its literal types.
