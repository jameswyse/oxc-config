import { ruleTester } from "../shared/rule-tester.ts";
import { noAmbientClock } from "./no-ambient-clock.ts";

ruleTester.run("no-ambient-clock", noAmbientClock, {
  valid: [
    'import { startOfToday } from "date-fns"; const dependencies = { now: () => startOfToday() as Date };',
    'import { isMatch } from "date-fns/fp"; const dependencies = { matches: () => isMatch("yyyy")("2026") satisfies boolean };',
    "const dependencies = { now: () => new Date()! };",
    "const dependencies = { now: () => (new Date()) };",
    "const dependencies = { now() { return Date.now() as number; } };",
    "const dependencies = { now: (() => new Date()) satisfies () => Date };",
    "function load(now = (() => Date.now()) as () => number) { return now; }",
    "const at = new Date(value);",
    "const at = Date.parse(value) + Date.UTC(2026, 0, 1);",
    "function age(birth: Date, now = new Date()) { return now.getFullYear() - birth.getFullYear(); }",
    "function expired(expiresAt: number, now: number = Date.now()) { return expiresAt < now; }",
    "function load({ now = new Date() }: { now?: Date } = {}) { return now; }",
    "const { now = new Date() } = options;",
    "function createService(clock: () => Date = () => new Date()) { return clock; }",
    "const dependencies = { now: Date.now };",
    "const dependencies = { now: () => new Date() };",
    "const dependencies = { now() { return Date.now(); } };",
    "const now = options.now ?? (() => Date.now());",
    "const now = options.now ?? Date.now;",
    "const started = performance.now();",
    "function read(Date: DateConstructor) { return Date.now(); }",
    "class Date {} const at = new Date();",
    'import { Date } from "./clock"; const at = Date.now();',
    'import { TZDate } from "@date-fns/tz"; const at = TZDate.tz("Australia/Sydney", now);',
    'import { TZDate } from "@date-fns/tz"; const at = TZDate.tz("Australia/Sydney", ...parts);',
    'import { TZDate } from "@date-fns/tz"; const at = new TZDate(now, zone);',
    'import { TZDate } from "@date-fns/tz"; const at = new TZDate(2026, 0, 1);',
    'import { TZDate } from "./time-zone"; const at = new TZDate();',
    'import { TZDate } from "@date-fns/tz/date"; const at = new TZDate(now, zone);',
    "class TZDate {} const at = new TZDate();",
    'import { tz } from "@date-fns/tz"; const zone = tz("Australia/Sydney");',
    'import { TZDate } from "@date-fns/tz"; const at = { now: () => TZDate.tz("UTC") };',
    'import { isSameDay } from "date-fns"; const same = isSameDay(a, now);',
    'import { formatDistance } from "date-fns"; const label = formatDistance(a, now);',
    'import * as d from "date-fns"; const valid = d.isValid(x);',
    'import { parse } from "date-fns"; const at = parse(value, "yyyy-MM-dd", now);',
    'import { isToday } from "./calendar"; const today = isToday(d);',
    "function isToday(date: Date) { return date.getDate() === 1; } const today = isToday(d);",
    'import { isToday } from "date-fns"; function check(isToday: (d: Date) => boolean) { return isToday(d); }',
    'import { constructNow } from "date-fns"; function load(now = constructNow(undefined)) { return now; }',
    'const { isValid } = await import("date-fns"); const valid = isValid(x);',
    'const d = await import("date-fns"); const alias = somethingElse; const today = alias.isToday(value);',
    'const d = await import("date-fns"); let alias = d; alias = calendar; const today = alias.isToday(value);',
    "const { isToday: check = () => false } = calendar; const today = check(d);",
    'function isMatch(format: string) { return (value: string) => value.length === format.length; } const matches = isMatch("yyyy")("2026");',
    'import { isMatch } from "./format"; const matches = isMatch(value, "yyyy");',
    'export { TZDate, TZDateMini } from "@date-fns/tz";',
    'export * from "@date-fns/tz";',
    'export { format, isSameDay } from "date-fns";',
    'export { default as addDays } from "date-fns/addDays";',
    'export * from "date-fns/addDays";',
    'export * as locales from "date-fns/locale";',
    'export type { isToday } from "date-fns";',
    'export { type isPast } from "date-fns";',
    'export type * from "date-fns";',
    'export { isToday } from "./calendar";',
    'export * from "./calendar";',
    'import { isPast } from "date-fns"; type Check = typeof isPast;',
    'import { isPast } from "date-fns"; const check: typeof isPast.length = 1;',
    'import * as d from "date-fns"; type Check = typeof d.isPast;',
    'import type { isPast } from "date-fns"; type Check = typeof isPast;',
    'import type { isPast } from "date-fns"; export { isPast };',
    'import { type isPast } from "date-fns"; export { isPast };',
    'import { isPast } from "date-fns"; export type { isPast };',
    'import { isPast } from "date-fns"; export { type isPast };',
    'import { isPast } from "date-fns"; const labels = { isPast: "Past" }; const flag = options.isPast;',
    'import { isPast } from "date-fns"; function keep(isPast: (d: Date) => boolean) { return dates.filter(isPast); }',
    'import { isPast } from "date-fns"; const days = dates.map((isPast) => isPast);',
    'import { isPast } from "./calendar"; const days = dates.filter(isPast);',
    'import { isValid } from "date-fns"; const days = dates.filter(isValid);',
    'import * as d from "date-fns"; const days = dates.filter(d.isValid);',
    'import { format } from "date-fns/fp"; const label = format("yyyy");',
    'import { isMatch } from "./format"; const years = values.filter(isMatch("yyyy"));',
    'import { isPast } from "date-fns"; function expired(dates: Date[], check = isPast) { return dates.filter(check); }',
    'import { isPast } from "date-fns"; function expired({ check = isPast }: Options) { return check; }',
    'import { isMatch } from "date-fns/fp"; function years(values: string[], matches = isMatch("yyyy")) { return values.filter(matches); }',
    'import { isPast } from "date-fns"; const check = isPast;',
    'import { isPast } from "date-fns"; const checks = { check: (d: Date) => isPast.call(null, d) };',
    'import { isPast } from "date-fns"; const checks = { check: (d: Date) => isPast.apply(null, [d]) };',
    'import { isPast } from "date-fns"; const checks = { check: () => isPast.bind(null) };',
    'import * as d from "date-fns"; const checks = { check: (value: Date) => d.isPast.call(null, value) };',
    'const d = require("date-fns"); d.isPast = customCheck;',
    'const d = require("date-fns"); d["isToday"] = customCheck;',
  ],
  invalid: [
    { code: "const at = Date.now();", errors: [{ messageId: "clock" }] },
    { code: "const at = new Date();", errors: [{ messageId: "clock" }] },
    { code: "const label = Date();", errors: [{ messageId: "clock" }] },
    { code: "const at = globalThis.Date.now();", errors: [{ messageId: "clock" }] },
    { code: "const at = new window.Date();", errors: [{ messageId: "clock" }] },
    { code: "const at = new Date(Date.now() + 1000);", errors: [{ messageId: "clock" }] },
    {
      code: "const expiresAt = response.expiresAt ?? Date.now();",
      errors: [{ messageId: "clock" }],
    },
    { code: "const [today] = useState(() => new Date());", errors: [{ messageId: "clock" }] },
    {
      code: "const dependencies = { now: () => new Date().toISOString() };",
      errors: [{ messageId: "clock" }],
    },
    {
      code: "function isFuture(date: Date) { return date > new Date(); }",
      errors: [{ messageId: "clock" }],
    },
    {
      code: "function age(birth: Date, now = new Date()) { return now.getTime() - birth.getTime() + Date.now(); }",
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDate } from "@date-fns/tz"; const at = TZDate.tz("Australia/Sydney");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDate } from "@date-fns/tz"; const at = new TZDate();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDateMini } from "@date-fns/tz"; const at = new TZDateMini();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDateMini as Zoned } from "@date-fns/tz"; const at = Zoned.tz(zone);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as timeZone from "@date-fns/tz"; const at = new timeZone.TZDate();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDate } from "@date-fns/tz/date"; const at = new TZDate();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDate } from "@date-fns/tz/date"; const at = TZDate.tz("UTC");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDateMini } from "@date-fns/tz/date/mini"; const at = new TZDateMini();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { constructNow } from "date-fns"; const at = constructNow(undefined);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isToday } from "date-fns"; const today = isToday(d);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast as hasPassed } from "date-fns"; const past = hasPassed(x);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as d from "date-fns"; const start = d.startOfToday();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import isPast from "date-fns/isPast"; const past = isPast(x);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isThisWeek } from "date-fns/isThisWeek"; const current = isThisWeek(x);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { formatDistanceToNowStrict } from "date-fns/formatDistanceToNowStrict"; const label = formatDistanceToNowStrict(x);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns"; const matches = isMatch(value, "yyyy-MM-dd");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; const matches = isMatch("yyyy-MM-dd")(value);',
      errors: [{ messageId: "clock", column: 55, endColumn: 83 }],
    },
    {
      code: 'import isMatchWithOptions from "date-fns/fp/isMatchWithOptions"; const matches = isMatchWithOptions({})("yyyy")(value);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; const matches = isMatch("yyyy", "2026");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as fp from "date-fns/fp"; const matches = fp.isMatchWithOptions({}, "yyyy")()("2026");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const start = (await import("date-fns")).startOfToday();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const { endOfToday } = await import("date-fns"); const end = endOfToday();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const d = await import("date-fns"); const tomorrow = d.isTomorrow(x);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const { isToday = () => false } = await import("date-fns"); const today = isToday(d);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const isToday = (await import("date-fns")).isToday; const today = isToday(d);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const d = await import("date-fns"); const alias = d; const today = alias.isToday(value);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as d from "date-fns"; const { startOfToday } = d; const start = startOfToday();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isToday } from "date-fns"; const today = (isToday as typeof isToday)(d);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as ns from "date-fns"; const today = ns!.isToday(d);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const { isToday } = await (import("date-fns") as Promise<Calendar>); const today = isToday(d);',
      languageOptions: { sourceType: "module" },
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDate } from "@date-fns/tz"; const at = (TZDate satisfies typeof TZDate).tz("UTC");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDate } from "@date-fns/tz"; const at = new (TZDate as typeof TZDate)();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: "const at = (Date as DateConstructor).now();",
      errors: [{ messageId: "clock" }],
    },
    {
      code: "const at = (globalThis.Date as DateConstructor).now();",
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { TZDate } from "@date-fns/tz"; const at = TZDate["tz"]("UTC");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const at = Date["now"]();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const at = new globalThis["Date"]();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: "const start = (await import(`date-fns`)).startOfToday();",
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as d from "date-fns"; const start = d[`startOfToday`]();',
      errors: [{ messageId: "clock" }],
    },
    { code: 'export { isToday } from "date-fns";', errors: [{ messageId: "clock" }] },
    {
      code: 'export { isPast as hasPassed } from "date-fns";',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'export { format, startOfToday } from "date-fns";',
      errors: [{ messageId: "clock", column: 17 }],
    },
    { code: 'export { default } from "date-fns/isPast";', errors: [{ messageId: "clock" }] },
    {
      code: 'export { default as now } from "date-fns/constructNow";',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'export { isThisWeek } from "date-fns/isThisWeek";',
      errors: [{ messageId: "clock" }],
    },
    { code: 'export { isMatch } from "date-fns/fp";', errors: [{ messageId: "clock" }] },
    {
      code: 'export { default as matches } from "date-fns/fp/isMatchWithOptions";',
      errors: [{ messageId: "clock" }],
    },
    { code: 'export * from "date-fns";', errors: [{ messageId: "clock" }] },
    { code: 'export * as d from "date-fns";', errors: [{ messageId: "clock" }] },
    { code: 'export * from "date-fns/fp";', errors: [{ messageId: "clock" }] },
    { code: 'export * from "date-fns/isToday";', errors: [{ messageId: "clock" }] },
    {
      code: "const at = (Date.now as typeof Date.now)();",
      errors: [{ messageId: "clock" }],
    },
    {
      code: "const at = Date.now!();",
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { startOfToday } from "date-fns"; const at = startOfToday() as Date;',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; const days = dates.filter(isPast);',
      errors: [{ messageId: "clock", column: 61, endColumn: 67 }],
    },
    {
      code: 'import { isToday } from "date-fns"; const checks = { check: isToday };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isToday } from "date-fns"; const checks = { isToday };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast as hasPassed } from "date-fns"; const days = dates.filter(hasPassed);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as d from "date-fns"; const days = dates.filter(d.isPast);',
      errors: [{ messageId: "clock", column: 57, endColumn: 65 }],
    },
    {
      code: 'import * as d from "date-fns"; const days = dates.filter(d["isPast"]);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import isPast from "date-fns/isPast"; const days = dates.filter(isPast);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns/isPast"; const days = dates.filter(isPast);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const { isPast } = await import("date-fns"); const days = dates.filter(isPast);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const days = dates.filter((await import("date-fns")).isPast);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; const days = dates.filter(isPast as (d: Date) => boolean);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; const past = isPast.call(undefined, d);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; function expired(dates: Date[]) { return dates.filter(isPast); }',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; const check = options.check ?? isPast;',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; let check = isPast;',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; const check = isPast; const days = dates.filter(check);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; const check = isPast; const past = check(d);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; export const check = isPast;',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; const years = values.filter(isMatch("yyyy"));',
      errors: [{ messageId: "clock", column: 67, endColumn: 82 }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; const matchesYear = isMatch("yyyy");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatchWithOptions } from "date-fns/fp"; const matchesYear = isMatchWithOptions({})("yyyy");',
      errors: [{ messageId: "clock", column: 70, endColumn: 100 }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; const matchesYear = isMatch("yyyy")();',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; const matches = isMatch("yyyy")(...values);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; const matchers = [isMatch];',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as fp from "date-fns/fp"; const years = values.filter(fp.isMatch("yyyy"));',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import isMatch from "date-fns/fp/isMatch"; const years = values.filter(isMatch("yyyy"));',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const { isMatch } = await import("date-fns/fp"); const years = values.filter(isMatch("yyyy"));',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; export { isPast };',
      errors: [{ messageId: "clock", column: 44, endColumn: 50 }],
    },
    {
      code: 'import { isPast } from "date-fns"; export { isPast as hasPassed };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; export default isPast;',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import isPast from "date-fns/isPast"; export { isPast };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns/isPast"; export { isPast };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import * as d from "date-fns"; const isPast = d.isPast; export { isPast };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const { isPast } = await import("date-fns"); export { isPast };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; export { isMatch };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import isMatchWithOptions from "date-fns/fp/isMatchWithOptions"; export { isMatchWithOptions };',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'const { isPast } = require("date-fns"); const days = dates.filter(isPast);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isPast } from "date-fns"; const days = dates.filter(isPast.bind(null));',
      errors: [{ messageId: "clock", column: 61, endColumn: 78 }],
    },
    {
      code: 'import { createRequire } from "node:module"; const today = createRequire(import.meta.url)("date-fns").isToday(d);',
      errors: [{ messageId: "clock" }],
    },
  ],
});
