import { ruleTester } from "../shared/rule-tester.ts";
import { noUncontrolledTestClock } from "./no-uncontrolled-test-clock.ts";

const error = { messageId: "clock" };
const performanceError = { messageId: "performance" };

ruleTester.run("no-uncontrolled-test-clock", noUncontrolledTestClock, {
  valid: [
    'test("expires", () => { expect(expiry(new Date("2026-10-14T00:00:00Z"))).toBe(false); });',
    'vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-14")); test("expires", () => { expect(expiry(new Date())).toBe(false); });',
    'import { mock, test } from "node:test"; mock.timers.enable({ apis: ["Date"] }); test("expires", () => { expect(expiry(new Date())).toBe(false); });',
    'import { mock as timersMock, test } from "node:test"; timersMock.timers.enable(); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'import { test, vi } from "vitest"; vi["useFakeTimers"](); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'import { test, vi } from "vitest"; test("frozen", () => { vi.useFakeTimers(); expect(expiry(Date.now())).toBe(false); });',
    'import { test, vi } from "vitest"; vi.useFakeTimers({ toFake: [] }); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'import { test, vi } from "vitest"; vi.useFakeTimers({ toFake: ["Date" as const] }); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'import { mock, test } from "node:test"; const apis = ["Date"] as const; mock.timers.enable({ apis: [...apis] }); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    'beforeEach(() => { clock.setFixedTime(new Date("2026-10-14")); }); test("expires", () => { expect(expiry(Date.now())).toBe(false); });',
    "const Date = fixedDate; test('now', () => { expect(Date.now()).toBe(1); });",
    "test('runs', () => { expect(clock.now()).toBe(1); });",
    'const { mock: m } = await import("node:test"); const test = (name: string, run: () => void) => run(); test("frozen", () => { m.timers.enable({ apis: ["Date"] }); }); test("reads", () => { expect(expiry(Date.now())).toBe(false); });',
    'const { test, mock: m } = await import("node:test"); test("frozen", () => { m.timers.enable({ apis: ["Date"] }); expect(expiry(Date.now())).toBe(false); });',
    'import { test } from "@playwright/test"; test("books tomorrow", async ({ page }) => { await book(page, new Date(Date.now() + 86_400_000)); });',
    'import { test } from "@playwright/test"; test("loads fast", async ({ page }) => { const started = performance.now(); await page.goto("/"); expect(performance.now() - started).toBeLessThan(500); });',
    'import { test, vi } from "vitest"; vi.useFakeTimers(); test("fast", () => { const started = performance.now(); run(); expect(performance.now() - started).toBeLessThan(500); });',
    'import { test, vi } from "vitest"; vi.useFakeTimers({ toFake: ["performance", "Date"] }); test("fast", () => { expect(globalThis.performance.now() - Date.now()).toBeLessThan(500); });',
    'import { test, vi } from "vitest"; vi.useFakeTimers({ toNotFake: ["setTimeout"] }); test("fast", () => { expect(window.performance.now()).toBe(0); });',
    'import { jest, test } from "@jest/globals"; jest.useFakeTimers(); test("fast", () => { expect(self.performance.now()).toBe(0); });',
    'import { jest, test } from "@jest/globals"; jest.useFakeTimers({ doNotFake: ["Date"] }); test("fast", () => { expect(performance.now()).toBe(0); });',
    'import FakeTimers from "@sinonjs/fake-timers"; import { performance } from "node:perf_hooks"; FakeTimers.install(); test("fast", () => { expect(performance.now()).toBe(0); });',
    'import { install } from "@sinonjs/fake-timers"; import * as hooks from "perf_hooks"; test("fast", () => { install({ toFake: ["performance"] }); expect(hooks.performance.now()).toBe(0); });',
    'import * as FakeTimers from "@sinonjs/fake-timers"; FakeTimers.install({ toFake: ["Date"] }); test("now", () => { expect(Date.now()).toBe(0); });',
    'beforeEach(async () => { await clock.install(); }); test("fast", () => { expect(performance.now()).toBe(0); });',
    'import { test, vi } from "vitest"; const timers = { toFake: ["performance"] }; vi.useFakeTimers(timers); test("fast", () => { expect(performance.now()).toBe(0); });',
    'import { test, vi } from "vitest"; const timers = { toFake: ["Date"] }; timers.toFake = ["performance"]; vi.useFakeTimers(timers); test("fast", () => { expect(performance.now()).toBe(0); });',
    'import { performance } from "node:perf_hooks"; test("fast", () => { const performance = fakePerformance; expect(performance.now()).toBe(0); });',
    'const performance = fakePerformance; test("fast", () => { expect(performance.now()).toBe(0); });',
    'import { test, vi } from "vitest"; const toFake = ["performance"]; vi.useFakeTimers({ toFake }); test("fast", () => { expect(performance.now()).toBe(0); });',
    'import { test, vi } from "vitest"; const toFake = flag ? ["Date"] : ["performance"]; vi.useFakeTimers({ toFake }); test("fast", () => { expect(performance.now()).toBe(0); });',
    'import { test, vi } from "vitest"; let toFake = ["Date"]; toFake = ["performance"]; vi.useFakeTimers({ toFake }); test("fast", () => { expect(performance.now()).toBe(0); });',
    'import { jest, test } from "@jest/globals"; jest.useFakeTimers({ legacyFakeTimers: false }); test("now", () => { expect(Date.now()).toBe(0); });',
    'import { jest, test } from "@jest/globals"; jest.useFakeTimers({ legacyFakeTimers: true, ...modern }); test("now", () => { expect(Date.now()).toBe(0); });',
    'import { jest, test } from "@jest/globals"; jest.useFakeTimers({ legacyFakeTimers: legacy }); test("now", () => { expect(Date.now()).toBe(0); });',
  ],
  invalid: [
    {
      code: 'import { test, vi } from "vitest"; const toFake = ["Date"]; vi.useFakeTimers({ toFake }); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; const toFake = ["Date"] as const; vi.useFakeTimers({ toFake }); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; const toFake = ["Date"] satisfies string[]; vi.useFakeTimers({ toFake }); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'import { jest, test } from "@jest/globals"; const doNotFake = ["performance"]; jest.useFakeTimers({ doNotFake }); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'import { install } from "@sinonjs/fake-timers"; const toNotFake = ["performance"]; install({ toNotFake }); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'import { mock, test } from "node:test"; const apis = ["setTimeout"]; mock.timers.enable({ apis }); test("now", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'import { jest, test } from "@jest/globals"; jest.useFakeTimers({ legacyFakeTimers: true }); test("now", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'import { jest, test } from "@jest/globals"; const legacy = { legacyFakeTimers: true }; jest.useFakeTimers(legacy); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'beforeEach(async () => { await clock.setFixedTime(0); }); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; const timers = { toFake: ["Date"] }; vi.useFakeTimers(timers); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; const defaults = { toFake: ["Date"] }; vi.useFakeTimers({ ...defaults }); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; const defaults = { toFake: ["Date"] }; vi.useFakeTimers({ toFake: ["performance"], ...defaults }); test("fast", () => { expect(performance.now()).toBe(0); });',
      errors: [performanceError],
    },
    {
      code: 'const { test, mock: m } = await import("node:test"); test("frozen", () => { m.timers.enable({ apis: ["Date"] }); }); test("reads", () => { m.timers.reset(); expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'const { test, mock: m } = require("node:test"); test("frozen", () => { m.timers.enable({ apis: ["Date"] }); }); test("reads", () => { m.timers.reset(); expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
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
      code: 'test("frozen", () => { vi.useFakeTimers(); expect(expiry(Date.now())).toBe(false); }); test("real", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'function setSystemTime() {} setSystemTime(); test("now", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'test("now", () => { expect(Date["now"]()).toBeGreaterThan(0); });',
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
    {
      code: 'import test, { mock } from "node:test"; const focused = test.only; focused("fixed", () => { mock.timers.enable({ apis: ["Date"] }); Date.now(); }); test("real", () => { mock.timers.reset(); Date.now(); });',
      errors: [{ ...error, column: 190 }],
    },
    {
      code: 'test("fast", () => { const started = performance.now(); run(); expect(performance.now() - started).toBeLessThan(500); });',
      errors: [performanceError, performanceError],
    },
    {
      code: 'test("fast", () => { expect(globalThis.performance.now() + window.performance["now"]() + self.performance.now()).toBeGreaterThan(0); });',
      errors: [performanceError, performanceError, performanceError],
    },
    {
      code: 'import { performance } from "node:perf_hooks"; test("fast", () => { expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import hooks from "perf_hooks"; test("fast", () => { expect(hooks.performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import * as hooks from "node:perf_hooks"; test("fast", () => { expect(hooks.performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'const { performance } = require("node:perf_hooks"); test("fast", () => { expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; vi.useFakeTimers({ toFake: ["Date"] }); test("fast", () => { expect(Date.now()).toBe(0); expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; vi.useFakeTimers({ toNotFake: ["performance"] }); test("fast", () => { expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; vi.setSystemTime(0); test("fast", () => { expect(Date.now()).toBe(0); expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import { performance } from "node:perf_hooks"; import { test, vi } from "vitest"; vi.useFakeTimers(); test("fast", () => { expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import { jest, test } from "@jest/globals"; jest.useFakeTimers({ doNotFake: ["performance"] }); test("fast", () => { expect(Date.now()).toBe(0); expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'const { performance } = require("perf_hooks"); jest.useFakeTimers(); test("fast", () => { expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import FakeTimers from "@sinonjs/fake-timers"; FakeTimers.install({ toFake: ["Date"] }); test("fast", () => { expect(Date.now()).toBe(0); expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import { install } from "@sinonjs/fake-timers"; install({ toNotFake: ["performance"] }); test("fast", () => { expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import { install } from "@sinonjs/fake-timers"; install({ toFake: ["performance"] }); test("now", () => { expect(Date.now()).toBeGreaterThan(0); });',
      errors: [error],
    },
    {
      code: 'import { mock, test } from "node:test"; mock.timers.enable(); test("fast", () => { expect(Date.now()).toBe(0); expect(performance.now()).toBeLessThan(500); });',
      errors: [performanceError],
    },
    {
      code: 'import { test, vi } from "vitest"; test("frozen", () => { vi.useFakeTimers(); performance.now(); }); test("real", () => { performance.now(); });',
      errors: [{ ...performanceError, column: 122 }],
    },
  ],
});
