import { ruleTester } from "../shared/rule-tester.ts";
import { noTestTimeoutOverrides } from "./no-test-timeout-overrides.ts";

ruleTester.run("no-test-timeout-overrides", noTestTimeoutOverrides, {
  valid: [
    'const a = b; const b = a; a("works", { timeout: 30_000 }, () => {});',
    'import { it } from "vitest"; it("works", () => {});',
    'import { it } from "vitest"; it("works", { tags: ["db"] }, () => {});',
    'import { test } from "@playwright/test"; test("works", { tag: "@slow" }, async () => {});',
    'import { test } from "@playwright/test"; test.describe.configure({ mode: "serial" });',
    'import { vi } from "vitest"; vi.setConfig({ restoreMocks: true });',
    'import { beforeEach } from "vitest"; beforeEach(() => {});',
    'import { it } from "./scenario"; it("works", () => {}, 5000);',
    'function it(name, run, timeout) {} it("works", () => {}, 5000);',
    'import { expect } from "@playwright/test"; await expect.poll(() => count(), { timeout: 20_000 }).toBe(0);',
    "setTimeout(() => {}, 5000);",
    "page.setTimeout(5000);",
    'import { it } from "vitest"; function suite(test) { test.slow(); }',
    "jest.retryTimes(3);",
    'import { vi } from "vitest"; vi.setConfig({ retry: 3 });',
    'import { test } from "vitest"; test("works", () => {}, { retry: 3 });',
    'import { test } from "@playwright/test"; test.describe.configure({ mode: "serial", retries: 2 });',
    'import { test } from "vitest"; test("tagged", { tag: "@smoke" }, callback);',
    'import { test } from "vitest"; const options = { tag: "@smoke" }; test("tagged", options, callback);',
    'import { test } from "vitest"; function check() {} test("tagged", { tag: "@smoke" }, check);',
    'import { test } from "vitest"; const check = async () => {}; test("works", run, check);',
    'import { beforeEach } from "vitest"; function reset() {} beforeEach(setup, reset);',
  ],
  invalid: [
    {
      code: 'import { vi } from "vitest"; vi.setConfig({ ["testTimeout"]: 20000 });',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { it } from "vitest"; it("works", () => {}, 10_000);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { it } from "@effect/vitest"; it.effect("works", () => Effect.void, 30_000);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { test } from "vitest"; test.each([1])("works %s", () => {}, LONG_TIMEOUT);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'it("works", { timeout: 15_000 }, () => {});',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { test } from "node:test"; test("works", { timeout: 60_000 }, async () => {});',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'const { test } = require("node:test"); test("works", { timeout: 60_000 }, async () => {});',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { beforeAll } from "vitest"; beforeAll(async () => {}, 30_000);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { it } from "vitest"; it("works", run, 10_000);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { it } from "vitest"; const run = () => {}; it("works", run, LONG_TIMEOUT);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test.setTimeout(120_000);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { test } from "./fixtures"; test("works", async () => { test.slow(); });',
      errors: [{ messageId: "override" }],
    },
    {
      code: "vi.setConfig({ testTimeout: 20_000 });",
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { vi } from "vitest"; vi.setConfig({ hookTimeout: 20_000 });',
      errors: [{ messageId: "override" }],
    },
    {
      code: "jest.setTimeout(30_000);",
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import test from "node:test"; const focused = test.only; focused("works", { timeout: 30_000 }, () => {});',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import test from "node:test"; const { only } = test; only("works", { timeout: 30_000 }, () => {});',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { only as focused } from "node:test"; focused("works", { timeout: 30_000 }, () => {});',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { test } from "vitest"; (test.only as typeof test)("works", () => {}, 30_000);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test.describe.configure({ timeout: 60_000 });',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { test } from "vitest"; test("works", { retry: 2, timeout: 30_000 }, () => {});',
      errors: [{ messageId: "override" }],
    },
  ],
});
