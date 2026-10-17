---
"@jameswyse/oxc-config": minor
---

`no-ambient-clock` reports more current-time reads outside the `clock` owners: argument-less `new TZDate()` and `new TZDateMini()` and one-argument `TZDate.tz(zone)` from `@date-fns/tz`, and calls to the date-fns helpers that read the clock, such as `constructNow`, `startOfToday`, `isToday`, `isPast`, `isThisWeek`, `formatDistanceToNow` and `isMatch`, whether imported by name, through a namespace, from a `date-fns/<name>` subpath, from `date-fns/fp` or by literal dynamic import. Projects with a `clock` owner list may see new errors.
