import { ruleTester } from "../shared/rule-tester.ts";
import { noFixedTestDelay } from "./no-fixed-test-delay.ts";

ruleTester.run("no-fixed-test-delay", noFixedTestDelay, {
  valid: [
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
    'import { test } from "vitest"; test("ready", async ({ page }) => { await page.waitForTimeout(100); });',
    'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await page.waitForSelector("button"); });',
    'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await (async (page) => { await page.waitForTimeout(100); })(customPage); });',
    'import { test } from "@playwright/test"; test("ready", async ({ page }) => { await otherPage.waitForTimeout(100); });',
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
  ],
  invalid: [
    {
      code: 'import { test } from "vitest"; import { setTimeout as delay } from "node:timers/promises"; test("ready", async () => { await delay(100); });',
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
  ],
});
