import { ruleTester } from "../shared/rule-tester.ts";
import { noFixedTestDelay } from "./no-fixed-test-delay.ts";

ruleTester.run("no-fixed-test-delay", noFixedTestDelay, {
  valid: [
    'import { it } from "@effect/vitest"; import { Effect, TestClock } from "effect"; it.effect("expires", () => Effect.gen(function* () { yield* TestClock.adjust("1 minute"); }));',
    'import { Effect } from "effect"; export const retry = Effect.gen(function* () { yield* Effect.sleep("50 millis"); });',
    'import { it } from "@effect/vitest"; import { Effect } from "effect"; it.effect("waits", () => Effect.gen(function* () { yield* Effect.sleep(backoff); }));',
    'import { it } from "@effect/vitest"; import { Effect } from "effect"; it.effect("waits", () => Effect.gen(function* () { yield* Effect.sleep(clock.remaining(1)); }));',
    'import { it } from "@effect/vitest"; import { Duration, Effect } from "effect"; it.effect("waits", () => Effect.gen(function* () { yield* Effect.sleep(Duration.millis(backoff)); }));',
    'import { setTimeout as delay } from "node:timers/promises"; await delay(100);',
    'import { test } from "vitest"; import { delay } from "./clock"; test("ready", async () => { await delay(100); });',
    'import { setTimeout as delay } from "node:timers/promises"; test("ready", async (delay) => { await delay(100); });',
    'import { setTimeout as delay } from "node:timers/promises"; function test(name, callback) {} test("ready", async () => { await delay(100); });',
    'import { test } from "other-test-framework"; test("ready", async () => { await new Promise(resolve => setTimeout(resolve, 100)); });',
    'test("ready", async (setTimeout) => { await new Promise(resolve => setTimeout(resolve, 100)); });',
    'test("ready", async (Promise) => { await new Promise(resolve => setTimeout(resolve, 100)); });',
    'test("ready", async () => { await new Promise(resolve => schedule(resolve, 100)); });',
    'test("ready", async () => { await new Promise(resolve => setTimeout(work, 100)); });',
    'test("ready", async () => { await new Promise(resolve => { start(); setTimeout(resolve, 100); }); });',
    'import { setTimeout as delay } from "node:timers/promises"; test("ready", async () => { await delay(configuredDelay); });',
    'const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)); test("x", async () => { await sleep(backoff); });',
    'const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)); let backoff = 100; test("x", async () => { await sleep(backoff); });',
    'const sleep = async (ms) => { await Bun.sleep(ms); log("slept"); }; test("x", async () => { await sleep(250); });',
    'const sleep = (ms) => { start(); return Bun.sleep(ms); }; test("x", async () => { await sleep(250); });',
    'const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); const nap = (ms) => sleep(ms); test("x", async () => { await nap(250); });',
    'import { sleep } from "./sleep"; test("x", async () => { await sleep(250); });',
    'const sleep = (ms) => Bun.sleep(ms); test("x", async (sleep) => { await sleep(250); });',
    'const sleep = (ms) => Bun.sleep(ms); test("x", async () => { const sleep = createSleeper(); await sleep(250); });',
    "const sleep = (ms) => Bun.sleep(ms); async function setup() { await sleep(250); }",
    'import { test } from "other-test-framework"; const sleep = (ms) => Bun.sleep(ms); test("x", async () => { await sleep(250); });',
    'const sleep = (ms) => Bun.sleep(ms); test("x", async () => { sleep(250); });',
    'const sleep = (ms) => { ms = ms * 2; return Bun.sleep(ms); }; test("x", async () => { await sleep(250); });',
    'const nap = (ms = backoff) => Bun.sleep(ms); test("x", async () => { await nap(); });',
    'const nap = (ms = 100) => Bun.sleep(ms); test("x", async () => { await nap(backoff); });',
    'const nap = (label, ms = 100) => Bun.sleep(ms); test("x", async () => { await nap(...args); });',
    'const sleep = (ms) => Bun.sleep(ms); test("x", () => Promise.all([1].map(() => sleep(5))));',
    'const sleep = (ms, factor) => Bun.sleep(factor); test("x", async () => { await sleep(250, backoff); });',
    'const sleep = (ms) => { Bun.sleep(ms); }; test("x", async () => { await sleep(250); });',
    'let sleep = (ms) => Bun.sleep(ms); test("x", async () => { await sleep(250); });',
    'const sleep = function* (ms) { yield Bun.sleep(ms); }; test("x", async () => { await sleep(250); });',
    'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await page.waitForSelector("button"); });',
    'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await page[method](100); });',
    'import { setTimeout as delay } from "node:timers/promises"; test.setTimeout("ready", async () => { await delay(100); });',
    'test("ready", async (globalThis) => { await new Promise(resolve => globalThis.setTimeout(resolve, 100)); });',
    'import test from "./test"; test("ready", async () => { await new Promise(resolve => setTimeout(resolve, 100)); });',
    'import test from "vitest"; test("ready", async () => { await new Promise(resolve => setTimeout(resolve, 100)); });',
    'import test from "@playwright/test"; function suite(test) { test("ready", async () => { await new Promise(resolve => setTimeout(resolve, 100)); }); }',
    'import test from "node:test"; import timers from "node:timers/promises"; test("ready", async (timers) => { await timers.setTimeout(100); });',
    'import test from "node:test"; import timers from "./timers"; test("ready", async () => { await timers.setTimeout(100); });',
    'import { test as base } from "vitest"; function suite(base) { const test = base.extend({}); test("ready", async () => { await new Promise(resolve => setTimeout(resolve, 100)); }); }',
    'import { it } from "@effect/vitest"; function suite(it) { it.effect("ready", () => Effect.promise(async () => { await new Promise(resolve => setTimeout(resolve, 100)); })); }',
    'import { it } from "vitest"; it.effect("ready", () => Effect.promise(async () => { await new Promise(resolve => setTimeout(resolve, 100)); }));',
    'test("ready", async () => { await new Promise(resolve => setTimeout(() => resolve(123), 100)); });',
    'test("ready", async () => { await new Promise(resolve => setTimeout((resolve) => resolve(), 100)); });',
    'test("ready", async () => { await new Promise(resolve => setTimeout(function resolve() { resolve(); }, 100)); });',
    'test("ready", async () => { await new Promise(resolve => setTimeout(() => { work(); resolve(); }, 100)); });',
    'test("ready", async () => { await new Promise(resolve => setTimeout(function* () { resolve(); }, 100)); });',
    'test("ready", async () => { await new Promise(function* (resolve) { setTimeout(resolve, 100); }); });',
    'import { scheduler } from "node:timers/promises"; await scheduler.wait(100);',
    'import { test } from "vitest"; import { scheduler } from "node:timers/promises"; test("ready", async () => { await scheduler.wait(configuredDelay); });',
    'import { test } from "vitest"; import { scheduler } from "node:timers/promises"; test("ready", async () => { await scheduler.yield(); });',
    'import { test } from "vitest"; import { scheduler } from "node:timers/promises"; test("ready", async () => { scheduler.wait(100); });',
    'import { test } from "vitest"; import { scheduler } from "./scheduler"; test("ready", async () => { await scheduler.wait(100); });',
    'import { test } from "vitest"; import timers from "./timers"; test("ready", async () => { await timers.scheduler.wait(100); });',
    'import { test } from "vitest"; test("ready", async () => { const scheduler = createScheduler(); await scheduler.wait(100); });',
    'import { test } from "vitest"; let delay = 100; test("ready", async () => { await scheduler.wait(delay); });',
    'import { test } from "vitest"; test("ready", async () => { await Bun.sleep(new Date(Date.now() + 100)); });',
    'import { test } from "vitest"; test("ready", async () => { await Bun.sleep(delay); });',
    'import { test } from "vitest"; import { Bun } from "./runtime"; test("ready", async () => { await Bun.sleep(100); });',
    'import { test } from "vitest"; test("ready", async (Bun) => { await Bun.sleep(100); });',
    'import { test } from "vitest"; test("ready", async () => { await Bun.sleepSync(100); });',
    "await Bun.sleep(100);",
    'import { test } from "vitest"; import { scheduler } from "node:timers/promises"; test("ready", async () => { await scheduler[method](300); });',
    'import { test } from "vitest"; test("ready", async () => { await Bun.sleep(delay as number); });',
    'import { test } from "vitest"; import { sleep } from "./bun"; test("ready", async () => { await sleep(100); });',
    'import { test } from "vitest"; import { sleep } from "bun"; test("ready", async (sleep) => { await sleep(100); });',
    'import { test } from "vitest"; import { sleep } from "bun"; test("ready", async () => { await sleep(delay); });',
    'import { test } from "vitest"; import { sleepSync } from "bun"; test("ready", async () => { await sleepSync(100); });',
    'import { sleep } from "bun"; await sleep(100);',
    'const sleep = (ms) => Bun.sleep(ms); test("x", () => { items.forEach(async () => sleep(100)); });',
    'const sleep = (ms) => Bun.sleep(ms); test("x", () => Promise.all([1].map(async () => sleep(5))));',
    'const sleep = (ms) => Bun.sleep(ms); test("x", () => Promise.all([1].map(async () => { return sleep(5); })));',
  ],
  invalid: [
    {
      code: 'const sleep = (ms) => Bun.sleep(ms); test("x", () => sleep(100));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const sleep = (ms) => Bun.sleep(ms); test("x", () => { return sleep(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("x", () => Bun.sleep(100));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("x", () => Bun.sleep(100) as Promise<void>);',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const sleep = () => Bun.sleep(100); test("x", () => sleep() as Promise<void>);',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const sleep = async () => (await Bun.sleep(100)) as void; test("x", () => sleep());',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("x", async () => { await (<Promise<void>>Bun.sleep(100)); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("x", () => { return (new Promise((resolve) => setTimeout(resolve, 100)) satisfies Promise<unknown>)!; });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: "beforeEach(function () { return Bun.sleep(100); });",
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("x", () => new Promise((resolve) => setTimeout(resolve, 100)));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const nap = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms)); test("x", async () => { await nap(); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const nap = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms)); test("x", async () => { await nap(undefined); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const nap = (ms = backoff) => new Promise((resolve) => setTimeout(resolve, ms)); test("x", async () => { await nap(250); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const sleep = (ms = 100) => Bun.sleep(ms); test("x", async () => { await sleep(250); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)); test("x", async () => { await sleep(250); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("x", async () => { await rest(300); }); function rest(ms) { return new Promise((resolve) => { setTimeout(resolve, ms); }); }',
      errors: [{ messageId: "delay" }],
    },
    {
      code: "const doze = function (ms) { return Bun.sleep(ms); }; beforeEach(async () => { await doze(10); });",
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { setTimeout as delay } from "node:timers/promises"; const pause = (ms) => delay(ms); test("x", async () => { await pause(20); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { setTimeout as delay } from "node:timers/promises"; const settle = () => delay(100); test("x", async () => { await settle(); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const settleMs = 100; const settle = async () => { await Bun.sleep(settleMs); }; test("x", async () => { await settle(); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const sleep = async (ms) => await Bun.sleep(ms); const pause = 50 as const; test("x", async () => { await sleep(pause); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { scheduler } from "node:timers/promises"; const sleep = (label, ms) => scheduler.wait(ms); test("x", async () => { await sleep("settle", 75); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "@playwright/test"; let delay = 500; test("ready", async ({ page }) => { await page.waitForTimeout(delay); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; test("ready", async ({ page }) => { await page.waitForTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await (async (page) => { await page.waitForTimeout(100); })(customPage); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await otherPage.waitForTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: "export async function settle(page) { await page.waitForTimeout(SETTLE_MS); }",
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "./fixtures"; test("ready", async ({ page }) => { await page.waitForTimeout(250); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: "export class LoginPage { constructor(page) { this.page = page; } async submit() { this.page.waitForTimeout(100); } }",
      errors: [{ messageId: "delay" }],
    },
    {
      code: "export const settle = (page) => page?.waitForTimeout();",
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "@playwright/test"; const delay = 500; test("ready", async ({ page }) => { await page.waitForTimeout(delay); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it } from "@effect/vitest"; import { Effect } from "effect"; const settle = "50 millis"; it.effect("settles", () => Effect.gen(function* () { yield* Effect.sleep(settle); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it } from "@effect/vitest"; import { Effect } from "effect"; it.effect("settles", () => Effect.gen(function* () { yield* Effect.sleep("50 millis"); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import { Duration, Effect } from "effect"; test("settles", () => Effect.runPromise(Effect.gen(function* () { yield* Effect.sleep(Duration.millis(1500)); })));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it } from "@effect/vitest"; import * as E from "effect"; it.effect("settles", () => E.Effect.gen(function* () { yield* E.Effect.sleep("50 millis"); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it } from "@effect/vitest"; import { Duration as D, Effect } from "effect"; it.effect("settles", () => Effect.gen(function* () { yield* Effect.sleep(D.millis(1500)); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it } from "@effect/vitest"; import { Effect } from "effect"; import * as Duration from "effect/Duration"; it.effect("settles", () => Effect.gen(function* () { yield* Effect.sleep(Duration.seconds(2)); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import { setTimeout as delay } from "node:timers/promises"; test("ready", async () => { await delay(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const { test } = require("vitest"); const { setTimeout: delay } = require("node:timers/promises"); test("ready", async () => { await delay(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it as scenario } from "@jest/globals"; import * as timers from "timers/promises"; scenario.only("ready", async () => { await timers.setTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import * as suite from "vitest"; import { setTimeout } from "node:timers/promises"; suite.test.each([1])("ready", async () => { await setTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test as scenario } from "vitest"; import { setTimeout as delay } from "node:timers/promises"; const check = scenario; const pause = delay; check("ready", async () => { await pause(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await new Promise(resolve => setTimeout(resolve, 100)); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: "beforeEach(async () => { await new Promise(done => { setTimeout(done, 0); }); });",
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await new Promise(resolve => { return globalThis.setTimeout(resolve, 100); }); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await page.waitForTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test as scenario } from "playwright/test"; scenario.beforeEach(async ({ page: browserPage }) => { await browserPage.waitForTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test as base } from "@playwright/test"; const test = base.extend({}); test("ready", async ({ page }) => { await page.waitForTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test as base } from "vitest"; import { setTimeout as delay } from "node:timers/promises"; const test = base.extend({}); test("ready", async () => { await delay(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import test from "@playwright/test"; test("ready", async ({ page }) => { await page.waitForTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import test from "node:test"; import timers from "node:timers/promises"; test("ready", async () => { await timers.setTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test as scenario } from "node:test"; import timers from "timers/promises"; scenario("ready", async () => { await timers.setTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { default as scenario } from "node:test"; scenario("ready", async () => { await new Promise(resolve => setTimeout(resolve, 100)); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it as scenario } from "@effect/vitest"; import { setTimeout as delay } from "node:timers/promises"; scenario.effect("ready", () => Effect.promise(async () => { await delay(100); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import * as suite from "@effect/vitest"; suite.it.live.only("ready", () => Effect.promise(async () => { await new Promise(resolve => setTimeout(resolve, 100)); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it } from "@effect/vitest"; it.scoped("ready", () => Effect.promise(async () => { await new Promise(resolve => setTimeout(resolve, 100)); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await new Promise(resolve => setTimeout(() => resolve(), 100)); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await new Promise(resolve => setTimeout(() => { resolve(); }, 100)); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await new Promise(resolve => setTimeout(function () { return resolve(); }, 100)); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import test from "node:test"; import { setTimeout } from "node:timers/promises"; const focused = test.only; focused("ready", async () => { await setTimeout(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import { scheduler } from "node:timers/promises"; test("ready", async () => { await scheduler.wait(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import { scheduler as tasks } from "timers/promises"; const settle = 50; test("ready", async () => { await tasks.wait(settle); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import * as timers from "node:timers/promises"; test("ready", async () => { await timers.scheduler.wait(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import test from "node:test"; import timers from "node:timers/promises"; test("ready", async () => { await timers.scheduler.wait(100, { signal }); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const { test } = require("vitest"); const { scheduler } = require("node:timers/promises"); test("ready", async () => { await scheduler.wait(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await page.evaluate(async () => {}); await scheduler.wait(250); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: "beforeEach(async () => { await scheduler.wait(0); });",
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await Bun.sleep(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; const settle = 25; test("ready", async () => { await Bun.sleep(settle); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import { scheduler } from "node:timers/promises"; test("ready", async () => { await scheduler["wait"](300); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import { scheduler } from "node:timers/promises"; test("ready", async () => { await scheduler[`wait`](300); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await Bun["sleep"](100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await page["waitForTimeout"](100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await new Promise(resolve => globalThis["setTimeout"](resolve, 100)); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { it } from "@effect/vitest"; import { Effect } from "effect"; it.effect("settles", () => Effect.gen(function* () { yield* Effect["sleep"]("50 millis"); }));',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await Bun.sleep(300 as const); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await Bun.sleep(300 satisfies number); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await Bun.sleep((-300) as const); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const settle = 25; test("ready", async () => { await Bun.sleep(settle!); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'const settle = 25 as const; test("ready", async () => { await Bun.sleep(settle); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { setTimeout as delay } from "node:timers/promises"; test("ready", async () => { await delay(100 as const); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'test("ready", async () => { await new Promise(resolve => setTimeout(resolve, 100 as const)); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await page.waitForTimeout(500 satisfies number); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import { sleep } from "bun"; test("ready", async () => { await sleep(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import { sleep as pause } from "bun"; test("ready", async () => { await pause(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import * as bun from "bun"; test("ready", async () => { await bun.sleep(100); });',
      errors: [{ messageId: "delay" }],
    },
    {
      code: 'import { test } from "vitest"; import Bun from "bun"; test("ready", async () => { await Bun.sleep(100); });',
      errors: [{ messageId: "delay" }],
    },
  ],
});
