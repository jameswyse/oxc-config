import { ruleTester } from "../shared/rule-tester.ts";
import { noTestRetries } from "./no-test-retries.ts";

function inFile(filename: string, code: string) {
  return { code, filename: `/project/${filename}` };
}

function reportedIn(filename: string, code: string, count = 1) {
  return {
    ...inFile(filename, code),
    errors: Array.from({ length: count }, () => ({ messageId: "retry" })),
  };
}

ruleTester.run("no-test-retries", noTestRetries, {
  valid: [
    'import { vi } from "vitest"; vi.setConfig({ retry: 0 });',
    "jest.retryTimes(0);",
    'import { vi } from "vitest"; vi.setConfig({ retry: 0 as const });',
    'import { test } from "vitest"; test("works", () => {}, { retry: 0 } as const);',
    'import { test } from "vitest"; test("works", { timeout: 30_000 }, () => {});',
    'import { vi } from "vitest"; vi.setConfig({ testTimeout: 20_000 });',
    'import { test } from "@playwright/test"; test.describe.configure({ mode: "serial", timeout: 60_000 });',
    'import { test } from "@playwright/test"; test.describe.configure({ retries: 0 });',
    'import { it } from "./scenario"; it("works", { retry: 3 }, () => {});',
    'function test(name, options, run) {} test("works", { retry: 3 }, () => {});',
    "retryTimes(3);",
    'import { jest } from "./jest"; jest.retryTimes(3);',
    'import { vi } from "./vi"; vi.setConfig({ retry: 3 });',
    "function suite(test) { test.describe.configure({ retries: 2 }); }",
    "fetchWithRetry(url, { retries: 3 });",
    'describe.each([{ retry: 3 }])("suite %s", () => {});',
    'import { describe } from "./suite"; describe.each([1])("suite %s", { retry: 3 }, () => {});',
    'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { retry: 2 } });',
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { retry: 0 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ retry: 2, test: { environment: "node" } });',
    ),
    inFile(
      "vite.config.ts",
      'import { defineConfig } from "vite"; export default defineConfig({ server: { retries: 3 } });',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retries: 0, projects: [{ name: "chromium", retries: 0 }] });',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retry: 2, use: { retries: 3 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; let shared = { retry: 2 }; shared = load(); export default defineConfig({ test: shared });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const options = load(); export default defineConfig(options);',
    ),
    inFile("src/config.ts", "export default { test: { retry: 2 }, retries: 2 };"),
    inFile("vitest-config.ts", "export default { test: { retry: 2 } };"),
    inFile("vitest.config.json", "export default { test: { retry: 2 } };"),
    inFile("playwright.config.ts", "export default { test: { retry: 2 } };"),
    inFile("src/client.ts", "fetchWithRetry({ retries: 3 }); new Client({ retry: 2 });"),
    inFile("src/client.ts", "module.exports = { retries: 3, test: { retry: 2 } };"),
    inFile(
      "src/client.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig(() => ({ test: { retry: 2 } }));',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retries: 2, ...{ retries: 0 } });',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; import shared from "./shared"; export default defineConfig({ retries: 2, ...shared });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const reset = { retry: 0 }; export default defineConfig({ test: { retry: 2, ...reset } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const config = { test: { projects: [config] } }; export default config;',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig(({ mode }) => { const nested = () => ({ test: { retry: 2 } }); return { test: { environment: mode } }; });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig as config } from "./local"; export default config({ test: { retry: 2 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { mergeConfig as merge } from "vitest/config"; export default merge({ test: { retry: 2 } }, { test: { retry: 0 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig, mergeConfig } from "vitest/config"; export default mergeConfig(defineConfig({ test: { retry: 2 } }), { test: { retry: 0 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig, mergeConfig } from "vitest/config"; const base = defineConfig({ test: { retry: 2 } }); export default mergeConfig(base, { test: { retry: 0 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { mergeConfig } from "vitest/config"; import overrides from "./overrides"; export default mergeConfig({ test: { retry: 2 } }, overrides);',
    ),
    inFile(
      "vitest.config.ts",
      'import { mergeConfig } from "vitest/config"; import overrides from "./overrides"; export default mergeConfig({ test: { retry: 2 } }, { test: overrides });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const settings = { ...settings }; export default defineConfig(settings);',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; var settings = { ...settings, test: { environment: "node" } }; export default defineConfig(settings);',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const projects = [...projects, { test: { name: "unit" } }]; export default defineConfig({ test: { projects } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const config = () => ({ test: { retry: 0 } }); export default defineConfig(config);',
    ),
    'import { vi } from "vitest"; const options = { retry: 2 }; options.retry = 0; vi.setConfig(options);',
    'import { vi } from "vitest"; const options = { test: { retry: 2 } }; options.test.retry = 0; vi.setConfig(options.test);',
    'import { vi } from "vitest"; const options = { retry: 2 }; delete options.retry; vi.setConfig(options);',
    'import { vi } from "vitest"; const options = { retry: 2 }; Object.assign(options, { retry: 0 }); vi.setConfig(options);',
    'import { vi } from "vitest"; const options = { retry: 2 }; Reflect.set(options, "retry", 0); vi.setConfig(options);',
    'import { vi } from "vitest"; vi.setConfig({ retry: 2, ...{ retry: undefined } });',
    inFile(
      "vitest.config.ts",
      'import { defineConfig, mergeConfig } from "vitest/config"; export default mergeConfig(defineConfig({ test: { retry: 0 } }), { test: { environment: "node" } }, { test: { retry: 2 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { retry: 0 } }, { test: { retry: 2 } });',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; function makeConfig() { return defineConfig(makeConfig); } export default defineConfig(makeConfig);',
    ),
    inFile(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const config = defineConfig({ test: { retry: 2 } }); export { config as default } from "./other";',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ projects: [{ name: "chromium", retries: 2 }] }, { projects: [{ name: "chromium", retries: 0 }] });',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retries: 2 }, { retries: undefined });',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ projects: [{ name: "chromium", retries: 2 }] }, { projects: undefined });',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; import overrides from "./overrides"; export default defineConfig({ projects: [{ name: "chromium", retries: 2 }] }, overrides);',
    ),
    inFile(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ projects: [{ name: "chromium", retries: 2 }] }, { projects: [{ name: browser, retries: 0 }] });',
    ),
  ],
  invalid: [
    { code: "jest.retryTimes(3);", errors: [{ messageId: "retry" }] },
    reportedIn(
      "vite.config.ts",
      'import { defineConfig } from "vite-plus"; export default defineConfig({ test: { retry: 2 } });',
    ),
    {
      code: 'import { vi } from "vite-plus/test"; vi.setConfig({ retry: 3 });',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { jest } from "@jest/globals"; jest.retryTimes(2, { logErrorsBeforeRetry: true });',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { test } from "vitest"; test("works", () => {}, { retry: 3 });',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { describe } from "vitest"; describe("suite", { retry: 2 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test.describe.configure({ mode: "serial", retries: 2 });',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { vi } from "vitest"; vi.setConfig({ retry: 2 });',
      errors: [{ messageId: "retry" }],
    },
    {
      code: "vi.setConfig({ retry: process.env.CI ? 2 : 0 });",
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { it } from "vitest"; it("works", { retry: 2, timeout: 30_000 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'it("works", { retries: 2 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { beforeEach } from "vitest"; beforeEach(() => {}, { retry: 2 });',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { test } from "vitest"; test.each([1])("works %s", { ["retry"]: 1 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'describe.each`a\n${1}`("suite $a", { retry: 3 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'describe.each([1])("suite %s", { retry: 3 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { describe } from "vitest"; describe.each([1])("suite %s", { retry: 3 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'describe.concurrent.each([1])("suite %s", { retry: 3 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { describe } from "vitest"; describe.skip.each([1])("suite %s", { retry: 3 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'describe.for([1])("suite %s", { retry: 3 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { describe } from "vitest"; describe.skip("suite", { retry: 2 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import { test } from "@playwright/test"; test.describe("suite", { retries: 1 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    {
      code: 'import test from "node:test"; const focused = test.only; focused("works", { retry: 2 }, () => {});',
      errors: [{ messageId: "retry" }],
    },
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { retry: 2 } });',
    ),
    reportedIn(
      "vitest.config.mts",
      'import { defineConfig } from "vitest/config"; export default defineConfig({ test: { retry: process.env.CI ? 2 : 0 } });',
    ),
    reportedIn(
      "vite.config.ts",
      'import { defineConfig } from "vite"; export default defineConfig({ test: { retry: 1 } } satisfies object);',
    ),
    reportedIn(
      "packages/web/vitest.e2e.config.ts",
      'import { defineConfig } from "vitest/config"; const test = { retry: 2 }; export default defineConfig({ test });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const config = { test: { retry: 2 } }; export default defineConfig(config);',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig, defineProject } from "vitest/config"; export default defineConfig({ test: { projects: [{ test: { name: "unit", retry: 2 } }, defineProject({ test: { name: "browser", retry: 3 } }), "packages/*"] } });',
      2,
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig, mergeConfig } from "vitest/config"; import base from "./vite.config"; export default mergeConfig(base, { test: { retry: 2 } });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig, mergeConfig } from "vitest/config"; import base from "./vite.config"; export default mergeConfig(base, defineConfig({ test: { retry: 2 } }));',
    ),
    reportedIn(
      "vitest.workspace.ts",
      'import { defineWorkspace } from "vitest/config"; export default defineWorkspace(["packages/*", { test: { name: "node", retry: 2 } }]);',
    ),
    reportedIn("vitest.workspace.js", 'export default ["packages/*", { test: { retry: 2 } }];'),
    reportedIn("vitest.config.js", "export default { test: { retry: 2 } };"),
    reportedIn("vitest.config.ts", "const shared = { test: { retry: 2 } }; export default shared;"),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retries: process.env.CI ? 2 : 0 });',
    ),
    reportedIn(
      "playwright.ci.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retries: 1, projects: [{ name: "chromium" }, { name: "firefox", retries: 2 }] });',
      2,
    ),
    reportedIn(
      "playwright.config.mjs",
      'const firefox = { name: "firefox", retries: 2 }; export default { projects: [firefox] };',
    ),
    reportedIn("jest.setup.ts", "jest.retryTimes(3);"),
    reportedIn("vitest.setup.ts", 'import { vi } from "vitest"; vi.setConfig({ retry: 3 });'),
    reportedIn(
      "e2e/checkout.spec.ts",
      'import { test } from "@playwright/test"; test.describe.configure({ retries: 2 });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig(() => ({ test: { retry: 2 } }));',
    ),
    reportedIn(
      "vite.config.ts",
      'import { defineConfig } from "vite"; export default defineConfig(({ mode }) => { if (mode === "ci") { return { test: { retry: 2 } }; } return { test: { retry: 1 } }; });',
      2,
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default defineConfig(function () { return { test: { retry: 2 } }; });',
    ),
    reportedIn("playwright.config.js", "module.exports = { retries: 2 };"),
    reportedIn(
      "playwright.config.cjs",
      'const { defineConfig } = require("@playwright/test"); module.exports = defineConfig({ retries: 2 });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig as config } from "vitest/config"; export default config({ test: { retry: 2 } });',
    ),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig as config } from "@playwright/test"; const settings = config({ retries: 2 }); export default settings;',
    ),
    reportedIn(
      "vitest.workspace.ts",
      'import * as vitest from "vitest/config"; export default vitest.defineWorkspace([{ test: { retry: 2 } }]);',
    ),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; const defaults = { retries: 2 }; export default defineConfig({ ...defaults });',
    ),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retries: 0, ...{ retries: 2 } });',
    ),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; import shared from "./shared"; export default defineConfig({ ...shared, retries: 2 });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const base = { test: { retry: 2 } }; export default defineConfig({ ...base, plugins: [] });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const config = { test: { retry: 2, projects: [config] } }; export default config;',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; let shared = { retry: 2 }; export default defineConfig({ test: shared });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const config = () => ({ test: { retry: 2 } }); export default defineConfig(config);',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; function config() { return { test: { retry: 2 } }; } export default defineConfig(config);',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { mergeConfig as merge } from "vitest/config"; export default merge({ test: { retry: 0 } }, { test: { retry: 2 } });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { mergeConfig } from "vitest/config"; export default mergeConfig({ test: { retry: 2 } }, { test: {} }, false);',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const config = defineConfig({ test: { retry: 2 } }); export { config as default };',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default process.env.CI ? defineConfig({ test: { retry: 2 } }) : defineConfig({});',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; export default process.env.CI && defineConfig({ test: { retry: 2 } });',
    ),
    reportedIn(
      "vitest.config.ts",
      "function config() { if (false) return config; return { test: { retry: 2 } }; } export default config;",
    ),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retries: 0 }, { retries: 2 });',
    ),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ retries: 2 }, { workers: 1 });',
    ),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ projects: [{ name: "chromium", retries: 2 }] }, { projects: [{ name: "firefox" }] });',
    ),
    reportedIn(
      "playwright.config.ts",
      'import { defineConfig } from "@playwright/test"; export default defineConfig({ projects: [{ name: "chromium" }] }, { projects: [{ name: "chromium", retries: 2 }] });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { mergeConfig } from "vitest/config"; export default mergeConfig({ test: { retry: 2 } }, { test: { retry: undefined, environment: "node" } });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { mergeConfig } from "vitest/config"; export default mergeConfig({ test: { projects: [{ test: { retry: 2 } }] } }, { test: { projects: [{ test: { retry: 3 } }] } });',
      2,
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; const projects = [{ test: { name: "unit", retry: 2 } }]; export default defineConfig({ test: { projects: [...projects, { test: { name: "e2e" } }] } });',
    ),
    reportedIn(
      "vitest.config.ts",
      'import { defineConfig } from "vitest/config"; var settings = { ...settings, test: { retry: 2 } }; export default defineConfig(settings);',
    ),
  ],
});
