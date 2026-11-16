---
"@jameswyse/oxc-config": minor
---

Add three warnings to the `effect` profile, outside tests: `wyse/no-dropped-error-cause` reports error handlers that create a new error without reading the original, `wyse/no-unbounded-retry` reports retries that repeat every failure forever, and `wyse/require-service-operation-span` reports service operations that create no span, unless they opt out with `Effect.fnUntraced`. `wyse/no-swallowed-errors` now also reports Effect v4's `Effect.catch` and `Effect.catchCause` recoveries that return a fallback.
