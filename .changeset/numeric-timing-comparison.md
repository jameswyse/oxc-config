---
"@jameswyse/oxc-config": patch
---

`wyse/no-timing-unsafe-comparison` no longer reports comparisons where either side is declared `number`, such as a counter named `suppressionToken`. Comparing numbers can't leak a secret through timing. The rule reads the type from the annotation on a variable or parameter, or on a property of an inline object type such as `{ count: number | undefined }` or `Readonly<{ count: number }>`, including a property destructured from a parameter, or from an `as number` cast. Named and inferred types still count as unknown, so those comparisons are still reported.
