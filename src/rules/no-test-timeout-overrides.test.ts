import { ruleTester } from "../shared/rule-tester.ts";
import { noTestTimeoutOverrides } from "./no-test-timeout-overrides.ts";

function inFile(filename: string, code: string) {
  return { code, filename: `/project/${filename}` };
}

function reportedIn(filename: string, code: string, count = 1) {
  return {
    ...inFile(filename, code),
    errors: Array.from({ length: count }, () => ({ messageId: "config" })),
  };
}

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
    'describe.each([{ timeout: 20_000 }])("suite %s", () => {});',
    'import { describe } from "./suite"; describe.each([1])("suite %s", () => {}, 20_000);',
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { projects: [{ test: { name: "e2e", testTimeout: 60_000 } }] } });',
    ),
    inFile(
      "vitest.workspace.ts",
      'import { defineWorkspace } from "vitest/config"; export default defineWorkspace([{ test: { name: "e2e", hookTimeout: 60_000 } }]);',
    ),
    inFile(
      "vitest.e2e.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { testTimeout: 60_000 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { environment: "node" }, server: { timeout: 60_000 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { mergeConfig } from "vitest/config"; import overrides from "./overrides"; export default mergeConfig({ test: { testTimeout: 20_000 } }, overrides);',
    ),
    inFile("src/config.ts", "export default { test: { testTimeout: 20_000 } };"),
  ],
  invalid: [
    {
      ...inFile(
        "vitest.config.ts",
        'import { defineConfig } from "vitest/config"; import { vi } from "vitest"; vi.setConfig({ testTimeout: 60_000 }); export default defineConfig({});',
      ),
      errors: [{ messageId: "override" }],
    },
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { testTimeout: 20_000, hookTimeout: 30_000 } });',
      2,
    ),
    reportedIn(
      "vite.config.ts",
      'import { defineConfig } from "vite"; export default defineConfig({ test: { testTimeout: process.env.CI ? 60_000 : 5_000, projects: [{ test: { name: "unit" } }] } });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig, mergeConfig } from "vitest/config"; import base from "./vite.config"; export default mergeConfig(base, defineConfig({ test: { testTimeout: 20_000 } }));',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig(({ mode }) => ({ test: { hookTimeout: 30_000, environment: mode } }));',
    ),
    reportedIn(
      "vitest.config.cjs",
      'const { defineConfig } = require("vitest/config"); const test = { testTimeout: 20_000 }; module.exports = defineConfig({ test });',
    ),
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
      code: 'describe.each`a\n${1}`("suite $a", () => {}, { timeout: 20_000 });',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'describe.each([1])("suite %s", () => {}, 20_000);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { describe } from "vitest"; describe.for([1])("suite %s", { timeout: 20_000 }, () => {});',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'describe.concurrent.each([1])("suite %s", { timeout: 20_000 }, () => {});',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'describe.skip.each([1])("suite %s", () => {}, 20_000);',
      errors: [{ messageId: "override" }],
    },
    {
      code: 'import { describe } from "vitest"; describe.only("suite", () => {}, 20_000);',
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
