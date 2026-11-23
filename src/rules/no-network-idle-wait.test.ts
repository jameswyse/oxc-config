import { ruleTester } from "../shared/rule-tester.ts";
import { noNetworkIdleWait } from "./no-network-idle-wait.ts";

const error = { messageId: "networkIdle" };

const waitUntilCalls = [
  "page.reload(",
  "page.goBack(",
  "page.goForward(",
  "page.waitForNavigation(",
  'page.waitForURL("**/done", ',
  "page.setContent(html, ",
];

ruleTester.run("no-network-idle-wait", noNetworkIdleWait, {
  valid: [
    'await page.waitForLoadState("load");',
    'await page.waitForLoadState("domcontentloaded");',
    "await page.waitForLoadState();",
    'await page.goto("/settings", { waitUntil: "commit" });',
    'await page.goto("/settings", { waitUntil: state });',
    'function open(state) { return page.goto("/settings", { waitUntil: state }); }',
    "await page.waitForLoadState(state);",
    'console.log("waiting for networkidle");',
    'const options = { waitUntil: "networkidle" };',
    'const options = { waitUntil: "networkidle" }; console.log(options.waitUntil);',
    'let state = "networkidle"; state = "load"; await page.waitForLoadState(state);',
    'let state = "networkidle"; state = "load"; await page.goto("/settings", { waitUntil: state });',
    'let options = { waitUntil: "networkidle" }; options = {}; await page.goto("/settings", options);',
    'await page.waitForLoadState(`network${"idle"}`);',
    'await page.goto("/settings", { [waitUntil]: "networkidle" });',
    'await page.goto("/settings", { timeout: "networkidle" });',
    'await page.goto("/settings", { waitUntil: ["load", "domcontentloaded"] });',
    'waitForLoadState("networkidle");',
    'expect(options).toEqual({ waitUntil: "networkidle" });',
    'assert.deepEqual(getSettings(), { waitUntil: "networkidle" });',
    'await page.goto(url, { waitUntil: "networkidle", ...{ waitUntil: "load" } });',
    'await page.goto(url, { waitUntil: "networkidle", ...overrides });',
    'const defaults = { waitUntil: "networkidle" }; defaults.waitUntil = "load"; await page.goto(url, defaults);',
    'await cache.setContent({ waitUntil: "networkidle" });',
    'await page.goto(url, { waitUntil: "load" }, { waitUntil: "networkidle" });',
    'await page.reload({ waitUntil: "load" }, { waitUntil: "networkidle" });',
  ],
  invalid: [
    { code: 'await page.waitForLoadState("networkidle");', errors: [error] },
    {
      code: 'await page.waitForLoadState("networkidle", { timeout: 5000 });',
      errors: [{ ...error, column: 28, endColumn: 41 }],
    },
    { code: 'await frame.waitForLoadState("networkidle");', errors: [error] },
    { code: 'await page?.["waitForLoadState"]("networkidle");', errors: [error] },
    { code: "await page.waitForLoadState(`networkidle`);", errors: [error] },
    { code: 'await page.waitForLoadState("networkidle" as const);', errors: [error] },
    {
      code: 'const state = "networkidle"; await page.waitForLoadState(state);',
      errors: [error],
    },
    {
      code: 'const state = "networkidle" satisfies string; await page.waitForLoadState(state);',
      errors: [error],
    },
    ...waitUntilCalls.map((call) => ({
      code: `await ${call}{ waitUntil: "networkidle" });`,
      errors: [error],
    })),
    {
      code: 'await page.goto("/settings", { waitUntil: "networkidle" });',
      errors: [{ ...error, column: 31, endColumn: 55 }],
    },
    { code: 'await frame?.["goto"](url, { "waitUntil": `networkidle2` });', errors: [error] },
    {
      code: 'await page.goto(url, { waitUntil: ["load", "networkidle0"] });',
      errors: [error],
    },
    {
      code: 'await page.goto(url, { waitUntil: "networkidle" as const, timeout: 5000 });',
      errors: [error],
    },
    {
      code: 'const waitUntil = "networkidle2"; await page.goto(url, { waitUntil });',
      errors: [error],
    },
    {
      code: 'let state = "networkidle"; await page.goto(url, { waitUntil: state });',
      errors: [error],
    },
    {
      code: 'const idle = "networkidle"; await page.goto(url, { waitUntil: ["load", idle] });',
      errors: [error],
    },
    {
      code: 'const states = ["networkidle0"] as const; await page.goto(url, { waitUntil: states });',
      errors: [error],
    },
    {
      code: 'const options = { waitUntil: "networkidle" }; await page.goto(url, options);',
      errors: [{ ...error, column: 18, endColumn: 42 }],
    },
    {
      code: 'const defaults = { waitUntil: "networkidle" }; await page.goto(url, { ...defaults });',
      errors: [{ ...error, column: 19, endColumn: 43 }],
    },
    {
      code: 'await page.goto(url, { waitUntil: "load", ...{ waitUntil: "networkidle" } });',
      errors: [error],
    },
    {
      code: 'const options = { waitUntil: "networkidle" } satisfies GotoOptions; await page.goto(a, options); await page.goto(b, options);',
      errors: [error],
    },
  ],
});
