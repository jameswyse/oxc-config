---
"@jameswyse/oxc-config": minor
---

`no-ambient-clock` reports a date-fns helper that reads the clock wherever it's used, not only where it's called: passed uncalled, such as `dates.filter(isPast)`, stored, such as `{ check: isToday }`, or exported by local name, such as `export { isPast }` or `export default isPast`. `isMatch` and `isMatchWithOptions` from `date-fns/fp` report once at the end of their call chain, so a partial application such as `values.filter(isMatch("yyyy"))` now reports. This covers helpers imported by name, through a namespace, from a `date-fns/<name>` subpath, by literal dynamic import or by `require`. Type positions such as `typeof isPast`, type-only imports and exports, parameter defaults such as `check = isPast`, and local bindings that shadow a helper still pass. Projects with a `clock` owner list may see new errors.
