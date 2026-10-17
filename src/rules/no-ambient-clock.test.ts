import { ruleTester } from "../shared/rule-tester.ts";
import { noAmbientClock } from "./no-ambient-clock.ts";

ruleTester.run("no-ambient-clock", noAmbientClock, {
  valid: [
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
    'import { isToday } from "date-fns"; const days = dates.filter(isToday);',
    'import { constructNow } from "date-fns"; function load(now = constructNow(undefined)) { return now; }',
    'const { isValid } = await import("date-fns"); const valid = isValid(x);',
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
      code: 'import { formatDistanceToNowStrict } from "date-fns/formatDistanceToNowStrict.js"; const label = formatDistanceToNowStrict(x);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns"; const matches = isMatch(value, "yyyy-MM-dd");',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import { isMatch } from "date-fns/fp"; const matches = isMatch("yyyy-MM-dd")(value);',
      errors: [{ messageId: "clock" }],
    },
    {
      code: 'import isMatchWithOptions from "date-fns/fp/isMatchWithOptions"; const matches = isMatchWithOptions({})("yyyy")(value);',
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
  ],
});
