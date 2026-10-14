import { ruleTester } from "../shared/rule-tester.ts";
import { noUncontrolledTestClock } from "./no-uncontrolled-test-clock.ts";

const error = { messageId: "clock" };

ruleTester.run("no-uncontrolled-test-clock", noUncontrolledTestClock, {
  valid: [
    'test("expires", () => { expect(expiry(new Date("2026-10-14T00:00:00Z"))).toBe(false); });',
    'vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-14")); test("expires", () => { expect(expiry(new Date())).toBe(false); });',
    'it.effect("expires", () => Effect.gen(function* () { yield* TestClock.adjust("1 hour"); const now = Date.now(); }));',
    "const Date = fixedDate; test('now', () => { expect(Date.now()).toBe(1); });",
    "test('runs', () => { expect(clock.now()).toBe(1); });",
    'import { test } from "@playwright/test"; test("books tomorrow", async ({ page }) => { await book(page, new Date(Date.now() + 86_400_000)); });',
  ],
  invalid: [
    {
      code: "test('ends', () => { const before = Date.now(); expect(run().endTime).toBeGreaterThanOrEqual(before); });",
      errors: [error],
    },
    {
      code: "test('invites', () => { expect(invite({ now: new Date() }).sent).toBe(true); });",
      errors: [error],
    },
    {
      code: "test('ticks', () => { const now = globalThis.Date.now(); expect(tick(now)).toBe(now + 1); });",
      errors: [error],
    },
  ],
});
