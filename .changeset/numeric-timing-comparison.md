---
"@jameswyse/oxc-config": patch
---

`wyse/no-timing-unsafe-comparison` no longer reports comparisons where either side is declared `number`, such as a counter named `suppressionToken`. Comparing numbers can't leak a secret through timing. The rule reads the type from the annotation on a variable or parameter, or on a property of an inline object type such as `{ count: number | undefined }` or `Readonly<{ count: number }>`, including a property destructured from a parameter. Named types, inferred types and casts such as `as number`, whether on the compared value or in a value written to its binding or one of its properties, still count as unknown, so those comparisons are still reported.
