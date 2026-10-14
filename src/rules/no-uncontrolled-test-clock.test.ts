import { ruleTester } from "../shared/rule-tester.ts";
import { noUncontrolledTestClock } from "./no-uncontrolled-test-clock.ts";

const error = { messageId: "clock" };

ruleTester.run("no-uncontrolled-test-clock", noUncontrolledTestClock, {
  valid: [
    'test("expires", () => { expect(expiry(new Date("2026-10-14T00:00:00Z"))).toBe(false); });',
    'vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-14")); test("expires", () => { expect(expiry(new Date())).toBe(false); });',
    'import { mock, test } from "node:test"; mock.timers.enable({ apis: ["Date"] }); test("expires", () => { expect(expiry(new Date())).toBe(false); });',
    'import { mock as timersMock, test } from "node:test"; timersMock.timers.enable(); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'import { test, vi } from "vitest"; vi["useFakeTimers"](); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'import { test, vi } from "vitest"; vi.useFakeTimers({ toFake: [] }); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'import { test, vi } from "vitest"; vi.useFakeTimers({ toFake: ["Date" as const] }); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'import { mock, test } from "node:test"; const apis = ["Date"] as const; mock.timers.enable({ apis: [...apis] }); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'beforeEach(() => { clock.setFixedTime(new Date("2026-10-14")); }); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
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
    {
      code: 'test("works without useFakeTimers", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'import { mock, test } from "node:test"; mock.timers.enable({ apis: ["setTimeout"] }); test("now", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'import { test, vi } from "vitest"; vi.useFakeTimers({ toFake: ["setTimeout"] }); test("now", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'import { jest, test } from "@jest/globals"; jest.useFakeTimers({ doNotFake: ["Date"] }); test("now", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'it.effect("expires", () => Effect.gen(function* () { yield* TestClock.adjust("1 hour"); const now = Date.now(); }));',
      errors: [error],
    },
  ],
});
