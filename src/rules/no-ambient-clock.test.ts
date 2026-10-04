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
  ],
});
