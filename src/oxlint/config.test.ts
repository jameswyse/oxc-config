import assert from "node:assert/strict";
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";

import { createFormatConfig } from "../oxfmt/config.ts";
import {
  formatBin,
  lint,
  lintBin,
  run,
  temporaryProject,
  write,
} from "../shared/config-fixture.ts";
import { createLintConfig } from "./config.ts";

import type { LintOptions } from "./config.ts";

const lintUrl = new URL("./config.ts", import.meta.url).href;

const formatUrl = new URL("../oxfmt/config.ts", import.meta.url).href;

function fixture(t: TestContext, options: LintOptions = {}): string {
  const root = temporaryProject(t);
  write(
    root,
    "oxlint.config.ts",
    `import { createLintConfig } from ${JSON.stringify(lintUrl)};\nexport default createLintConfig({ root: import.meta.dirname, ...${JSON.stringify({ typeAware: false, ...options })} });\n`,
  );
  write(
    root,
    "oxfmt.config.ts",
    `import { createFormatConfig } from ${JSON.stringify(formatUrl)};\nexport default createFormatConfig();\n`,
  );

  return root;
}

test("a relocated consumer loads both plugins without a package manifest or tsconfig", (t) => {
  const root = fixture(t);
  write(root, "src/add.mjs", "export function add(left, right) {\n  return left + right;\n}\n");
  const result = lint(root, "src");
  assert.equal(result.status, 0, result.output);
});

test("static TypeScript and wyse rules apply to every supported TypeScript extension", (t) => {
  const root = fixture(t);

  for (const extension of ["ts", "tsx", "mts", "cts"]) {
    write(root, `src/value.${extension}`, "export const value = input as any as string;\n");
    const result = lint(root, `src/value.${extension}`);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /no-explicit-any/);
    assert.match(result.output, /no-chained-type-assertions/);
  }
});

test("every optional profile and their combination load in the actual CLI", (t) => {
  for (const options of [
    { node: true },
    { react: true },
    { nextjs: true },
    { vitest: true },
    { jest: true },
    { effect: true },
    {
      node: ["server/**"],
      react: ["client/**"],
      nextjs: ["app"],
      vitest: ["tests/**"],
      effect: ["server/**"],
    },
  ]) {
    const root = fixture(t, options);
    const result = run(root, lintBin, ["--print-config"]);
    assert.equal(result.status, 0, `${JSON.stringify(options)}\n${result.output}`);
  }
});

test("type-aware checking catches promises and unsafe assignments with a real tsconfig", (t) => {
  const root = fixture(t, { typeAware: true });
  symlinkSync(
    new URL("../../node_modules", import.meta.url),
    join(root, "node_modules"),
    "junction",
  );
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { target: "ES2022", strict: true, noEmit: true },
      include: ["src/**/*.ts"],
    }),
  );
  write(
    root,
    "src/unsafe.ts",
    'export const value: string = JSON.parse("{}");\n\nPromise.resolve(1);\n',
  );
  const result = lint(root, "src");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /no-floating-promises/);
  assert.match(result.output, /no-unsafe-assignment/);
});

test("application default exports are rejected while config and Next entrypoints are accepted", (t) => {
  const root = fixture(t, { nextjs: true });
  const source = "export default function Page() {\n  return null;\n}\n";
  write(root, "app/page.tsx", source);
  write(root, "src/ordinary.tsx", source);
  write(root, "vite.config.mts", "export default {};\n");
  const page = lint(root, "app/page.tsx", "vite.config.mts");
  assert.equal(page.status, 0, page.output);
  const ordinary = lint(root, "src/ordinary.tsx");
  assert.equal(ordinary.status, 1, ordinary.output);
  assert.match(ordinary.output, /no-default-export/);
});

test("framework policy is scoped and React rules survive a matching test override", (t) => {
  const root = fixture(t, { react: ["client/**"], vitest: true });
  const source = 'export function View() {\n  return <img src="/image.png" />;\n}\n';
  write(root, "client/view.test.tsx", source);
  write(root, "server/view.test.tsx", source);
  const client = lint(root, "client/view.test.tsx");
  assert.equal(client.status, 1, client.output);
  assert.match(client.output, /alt-text/);
  const server = lint(root, "server/view.test.tsx");
  assert.equal(server.status, 0, server.output);
});

test("nested label text and empty table cells are accessible while empty labels are not", (t) => {
  const root = fixture(t, { react: true });
  write(
    root,
    "src/form.tsx",
    'export function Form() {\n  return (\n    <table>\n      <tbody>\n        <tr>\n          <td />\n          <td>\n            <label>\n              <span>\n                <span>Email</span>\n              </span>\n              <input type="email" />\n            </label>\n          </td>\n        </tr>\n      </tbody>\n    </table>\n  );\n}\n',
  );
  const valid = lint(root, "src/form.tsx");
  assert.equal(valid.status, 0, valid.output);
  write(
    root,
    "src/empty.tsx",
    'export function Empty() {\n  return (\n    <label>\n      <span />\n      <input type="email" />\n    </label>\n  );\n}\n',
  );
  const empty = lint(root, "src/empty.tsx");
  assert.equal(empty.status, 1, empty.output);
  assert.match(empty.output, /label-has-associated-control/);
});

test("separate React and Next glob scopes both receive React policy", (t) => {
  const root = fixture(t, { react: ["ui/**"], nextjs: ["web"] });
  const source = 'export function View() {\n  return <img src="/image.png" />;\n}\n';

  for (const path of ["ui/view.tsx", "web/view.tsx"]) {
    write(root, path, source);
    const result = lint(root, path);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /alt-text/);
  }
});

test("custom test rules follow explicitly configured test-runner paths", (t) => {
  const root = fixture(t, { vitest: ["checks/**/*.ts"] });
  write(
    root,
    "checks/result.ts",
    'import { expect, test } from "vitest";\n\ntest("result", () => {\n  expect(1).toBe(1);\n});\n',
  );
  const result = lint(root, "checks/result.ts");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /no-vacuous-test-assertions/);
});

test("Next entrypoint exceptions stay inside the selected app roots", (t) => {
  const root = fixture(t, { nextjs: ["apps/web"] });
  const source = "export default function Page() {\n  return null;\n}\n";

  for (const path of [
    "apps/web/app/forbidden.tsx",
    "apps/web/src/app/unauthorized.tsx",
    "apps/web/app/global-not-found.tsx",
  ]) {
    write(root, path, source);
    const result = lint(root, path);
    assert.equal(result.status, 0, result.output);
  }

  write(root, "packages/server/pages/report.ts", source);
  const unrelated = lint(root, "packages/server/pages/report.ts");
  assert.equal(unrelated.status, 1, unrelated.output);
  assert.match(unrelated.output, /no-default-export/);
});

test("top-level static TypeScript rule changes are honoured", (t) => {
  const root = fixture(t);
  write(
    root,
    "oxlint.config.ts",
    `import { createLintConfig } from ${JSON.stringify(lintUrl)};\nconst base = createLintConfig({ typeAware: false });\nexport default { ...base, rules: { ...base.rules, "typescript/no-non-null-assertion": "off" } };\n`,
  );
  write(
    root,
    "value.ts",
    "declare const input: string | undefined;\n\nexport const value = input!;\n",
  );
  const result = lint(root, "value.ts");
  assert.equal(result.status, 0, result.output);
});

test("schema-owned underscore fields and intentionally unused bindings remain valid", (t) => {
  const root = fixture(t);
  write(
    root,
    "document.ts",
    "export function read(doc: { _id: string; __typename: string }) {\n  const _unused = 1;\n\n  return doc._id + doc.__typename;\n}\n",
  );
  const result = lint(root, "document.ts");
  assert.equal(result.status, 0, result.output);
});

test("common build outputs are ignored and dot-directory source remains linted", (t) => {
  const root = fixture(t);
  write(root, "dist/unsafe.ts", "export const value: any = 1;\n");
  write(root, ".claude/unsafe.ts", "export const value: any = 1;\n");
  write(root, ".storybook/unsafe.ts", "export const value: any = 1;\n");
  write(root, "src/build/unsafe.ts", "export const value: any = 1;\n");
  write(root, "src/out/unsafe.ts", "export const value: any = 1;\n");
  const result = lint(root, ".");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /\.storybook\/unsafe.ts/);
  assert.match(result.output, /src\/build\/unsafe.ts/);
  assert.match(result.output, /src\/out\/unsafe.ts/);
  assert.doesNotMatch(result.output, /dist\/unsafe.ts/);
  assert.doesNotMatch(result.output, /\.claude\/unsafe.ts/);
});

test("lint fixes and formatting converge while side-effect import order is preserved", (t) => {
  const root = fixture(t);
  write(root, "sample.ts", "export const a=1;\nexport const b={\n  c: 1,\n};\n");
  const fix = lint(root, "--fix", "sample.ts");
  assert.equal(fix.status, 0, fix.output);
  const formatted = run(root, formatBin, ["sample.ts"]);
  assert.equal(formatted.status, 0, formatted.output);
  const result = readFileSync(join(root, "sample.ts"), "utf8");
  assert.equal(result, "export const a = 1;\n\nexport const b = {\n  c: 1,\n};\n");
  assert.equal(lint(root, "sample.ts").status, 0);
  assert.equal(run(root, formatBin, ["--check", "sample.ts"]).status, 0);
  write(root, "imports.ts", 'import "./z.css";\nimport "./a.css";\n');
  assert.equal(run(root, formatBin, ["imports.ts"]).status, 0);
  assert.equal(
    readFileSync(join(root, "imports.ts"), "utf8"),
    'import "./z.css";\nimport "./a.css";\n',
  );
  write(
    root,
    "ternary.ts",
    'export function label(first: boolean, second: boolean) {\n  return first ? "first" : second ? "second" : "last";\n}\n',
  );
  assert.equal(run(root, formatBin, ["ternary.ts"]).status, 0);
  const ternary = lint(root, "ternary.ts");
  assert.equal(ternary.status, 0, ternary.output);
});

test("an extended sortImports keeps the shared groups and adds an internal prefix", (t) => {
  const root = fixture(t);

  const config = createFormatConfig({
    sortImports: { internalPattern: ["@/", "#", "@my-workspace/"] },
  });

  write(root, "oxfmt.config.ts", `export default ${JSON.stringify(config)};\n`);
  write(
    root,
    "imports.ts",
    'import { z } from "zod";\nimport { db } from "@my-workspace/db";\nimport { useState } from "react";\n\nexport { db, useState, z };\n',
  );
  const formatted = run(root, formatBin, ["imports.ts"]);
  assert.equal(formatted.status, 0, formatted.output);
  assert.equal(
    readFileSync(join(root, "imports.ts"), "utf8"),
    'import { useState } from "react";\n\nimport { z } from "zod";\n\nimport { db } from "@my-workspace/db";\n\nexport { db, useState, z };\n',
  );
});

test("framework-loaded stories, Storybook and tool entrypoints may default export", (t) => {
  const root = fixture(t);
  write(root, "src/Button.stories.tsx", "export default { title: 'Button' };\n");
  write(root, ".storybook/main.ts", "export default {};\n");
  write(root, "apps/studio/sanity.cli.ts", "export default {};\n");
  write(root, "codegen.ts", "export default {};\n");

  const result = lint(
    root,
    "src/Button.stories.tsx",
    ".storybook/main.ts",
    "apps/studio/sanity.cli.ts",
    "codegen.ts",
  );

  assert.equal(result.status, 0, result.output);
});

test("environment reads are limited to configured owners and entrypoints", (t) => {
  const root = fixture(t, { env: ["src/config.ts"] });
  const source = "export const port = process.env.PORT;\n";
  write(root, "src/config.ts", source);
  write(root, "scripts/seed.ts", source);
  write(root, "src/server.ts", source);
  assert.equal(lint(root, "src/config.ts", "scripts/seed.ts").status, 0);
  const server = lint(root, "src/server.ts");
  assert.equal(server.status, 1, server.output);
  assert.match(server.output, /no-env-access/);
  const unconfigured = fixture(t);
  write(unconfigured, "src/server.ts", source);
  assert.equal(lint(unconfigured, "src/server.ts").status, 0);
});

test("security rules apply to source files and keep shell and timing checks out of tests", (t) => {
  const root = fixture(t);
  const source = `import { exec } from "node:child_process";\n\n// ${String.fromCodePoint(0x202e)} reviewed\n\nexport function verify(token: string, expected: string, input: string): boolean {\n  exec(\`git log \${input}\`);\n  const plugin: unknown = require(input);\n\n  return token === expected && new RegExp(input).test(token) && /^(a+)+$/.test(token) && plugin !== null;\n}\n`;
  write(root, "src/verify.ts", source);
  write(root, "src/verify.test.ts", source);
  write(root, "e2e/verify.e2e.ts", source);

  const sharedRules = [
    /no-bidi-control-characters/,
    /no-dynamic-regex/,
    /no-exponential-regex/,
    /no-dynamic-require/,
  ];

  const production = lint(root, "src/verify.ts");
  assert.equal(production.status, 1, production.output);

  for (const rule of [...sharedRules, /no-dynamic-shell-command/, /no-timing-unsafe-comparison/]) {
    assert.match(production.output, rule);
  }

  const unit = lint(root, "src/verify.test.ts");

  for (const rule of sharedRules) {
    assert.match(unit.output, rule);
  }

  assert.doesNotMatch(unit.output, /no-dynamic-shell-command|no-timing-unsafe-comparison/);

  const endToEnd = lint(root, "e2e/verify.e2e.ts");
  assert.match(endToEnd.output, /no-exponential-regex/);
  assert.doesNotMatch(endToEnd.output, /no-dynamic-shell-command|no-timing-unsafe-comparison/);
});

test("import boundaries reject bare and resolved relative imports but allow type imports", (t) => {
  const root = fixture(t, {
    boundaries: [
      {
        files: ["src/renderer/**"],
        deny: ["electron", "node:*", "src/main/**"],
        message: "Use the preload API.",
      },
    ],
  });

  write(root, "src/main/ipc.ts", "export const channel = 'save';\nexport type Channel = string;\n");
  write(
    root,
    "src/renderer/view.ts",
    "import { channel } from '../main/ipc';\nimport { ipcRenderer } from 'electron';\nexport const values = [channel, ipcRenderer];\n",
  );
  write(
    root,
    "src/renderer/types.ts",
    "import type { Channel } from '../main/ipc';\n\nexport const channel: Channel = 'save';\n",
  );
  write(
    root,
    "src/main/app.ts",
    "import { readFile } from 'node:fs/promises';\n\nexport { readFile };\n",
  );
  const view = lint(root, "src/renderer/view.ts");
  assert.equal(view.status, 1, view.output);
  assert.equal(view.output.match(/import-boundaries/g)?.length, 2, view.output);
  assert.match(view.output, /Use the preload API/);
  const allowed = lint(root, "src/renderer/types.ts", "src/main/app.ts");
  assert.equal(allowed.status, 0, allowed.output);
});

test("import boundaries check require calls and reject type imports when a boundary asks", (t) => {
  const root = fixture(t, {
    boundaries: [
      {
        files: ["src/features/**"],
        deny: ["src/generated/**"],
        message: "Features own their unions.",
        types: true,
      },
      { files: ["src/legacy/**"], deny: ["node:*"], message: "Legacy code stays portable." },
    ],
  });

  write(root, "src/generated/graphql.ts", "export type ActivityApp = 'web';\n");
  write(
    root,
    "src/features/activity.ts",
    "import type { ActivityApp } from '../generated/graphql';\n\nexport const app: ActivityApp = 'web';\nexport type Imported = import('../generated/graphql').ActivityApp;\n",
  );
  write(
    root,
    "src/legacy/files.cjs",
    "const fs = require('node:fs');\n\nmodule.exports = { fs };\n",
  );
  const types = lint(root, "src/features/activity.ts");
  assert.equal(types.output.match(/import-boundaries/g)?.length, 2, types.output);
  write(
    root,
    "src/features/loader.ts",
    "import { createRequire as makeRequire } from 'node:module';\n\nconst load = makeRequire(import.meta.url);\nconst lookup = cache.createRequire('graphql');\nconst { createRequire: makeLoader = makeRequire } = await import('node:module');\nconst loadLater = makeLoader(import.meta.url);\n\nexport const graphql = load('../generated/graphql');\nexport const cached = lookup('../generated/graphql');\nexport const later = loadLater('../generated/graphql');\nexport const inline = makeRequire(import.meta.url)('../generated/graphql');\nconst copy = load;\nexport const copied = copy('../generated/graphql');\n",
  );
  const required = lint(root, "src/legacy/files.cjs");
  assert.equal(required.output.match(/import-boundaries/g)?.length, 1, required.output);
  const created = lint(root, "src/features/loader.ts");
  assert.equal(created.output.match(/import-boundaries/g)?.length, 4, created.output);
});

test("server actions must await a configured guard outside tests", (t) => {
  const root = fixture(t, { serverActionGuards: ["requireStaff"], vitest: true });
  const unguarded = '"use server";\n\nexport async function save() {\n  return 1;\n}\n';
  write(root, "app/actions.ts", unguarded);
  write(root, "app/actions.test.ts", unguarded);
  const actions = lint(root, "app/actions.ts");
  assert.equal(actions.status, 1, actions.output);
  assert.match(actions.output, /server-action-guard/);
  assert.equal(lint(root, "app/actions.test.ts").status, 0);
});

test("dependency cycles and barrels warn without failing the run", (t) => {
  const root = fixture(t);
  write(root, "src/a.ts", "import { b } from './b';\n\nexport const a = (): number => b();\n");
  write(root, "src/b.ts", "import { a } from './a';\n\nexport const b = (): number => a();\n");
  const result = lint(root, "src");
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /no-cycle/);
});

test("clock and random reads are limited to configured owners outside tests", (t) => {
  const root = fixture(t, { clock: ["src/clock.ts"], random: ["src/ids.ts"], vitest: true });
  write(root, "src/clock.ts", "export function now(): number {\n  return Date.now();\n}\n");
  write(root, "src/ids.ts", "export function id(): string {\n  return crypto.randomUUID();\n}\n");
  write(
    root,
    "src/order.ts",
    "export function stamp(): string {\n  return `${Date.now()}-${crypto.randomUUID()}`;\n}\n",
  );
  write(
    root,
    "src/order.test.ts",
    'import { expect, it, vi } from "vitest";\n\nimport { stamp } from "./order";\n\nvi.useFakeTimers();\n\nit("stamps", () => {\n  expect(stamp()).not.toBe(`${Date.now()}`);\n});\n',
  );
  const owners = lint(root, "src/clock.ts", "src/ids.ts", "src/order.test.ts");
  assert.equal(owners.status, 0, owners.output);
  const order = lint(root, "src/order.ts");
  assert.equal(order.status, 1, order.output);
  assert.match(order.output, /no-ambient-clock/);
  assert.match(order.output, /no-ambient-random/);
});

test("boundary globs resolve from the config file when Oxlint runs inside a package", (t) => {
  const root = fixture(t, {
    boundaries: [
      {
        files: ["apps/web/src/ui/**"],
        deny: ["node:*", "apps/api/**"],
        message: "UI code stays in the browser.",
      },
    ],
  });

  write(root, "apps/api/src/handler.ts", "export const handler = 'save';\n");
  write(
    root,
    "apps/web/src/ui/view.ts",
    "import { readFile } from 'node:fs';\nimport { handler } from '../../../api/src/handler';\n\nexport const values = [readFile, handler];\n",
  );
  write(
    root,
    "apps/web/src/server.ts",
    "import { readFileSync } from 'node:fs';\n\nexport const config = readFileSync('config.json', 'utf8');\n",
  );
  const result = run(join(root, "apps/web"), lintBin, ["--format", "json", "."]);
  assert.equal(result.status, 1, result.output);
  assert.equal(result.output.match(/import-boundaries/g)?.length, 2, result.output);
  assert.doesNotMatch(result.output, /server\.ts/);
});

test("boundaries and the electron profile require the config root", () => {
  const boundaries = [{ files: ["src/ui/**"], deny: ["node:*"], message: "Stay in the browser." }];
  assert.throws(() => createLintConfig({ boundaries }), /root: import\.meta\.dirname/);
  assert.throws(() => createLintConfig({ electron: true }), /root: import\.meta\.dirname/);
});

test("the electron profile guards renderer imports and window preferences", (t) => {
  const root = fixture(t, { electron: true });
  write(
    root,
    "src/renderer/app.ts",
    "import { ipcRenderer } from 'electron';\n\nexport const ipc = ipcRenderer;\n",
  );
  write(
    root,
    "src/main/window.ts",
    "import { BrowserWindow } from 'electron';\n\nexport function open(): BrowserWindow {\n  return new BrowserWindow({ webPreferences: { contextIsolation: false } });\n}\n",
  );
  const renderer = lint(root, "src/renderer/app.ts");
  assert.equal(renderer.status, 1, renderer.output);
  assert.match(renderer.output, /import-boundaries/);
  const main = lint(root, "src/main/window.ts");
  assert.equal(main.status, 1, main.output);
  assert.match(main.output, /electron-secure-web-preferences/);
  const plain = fixture(t);
  write(
    plain,
    "src/renderer/app.ts",
    "import { ipcRenderer } from 'electron';\n\nexport const ipc = ipcRenderer;\n",
  );
  const withoutProfile = lint(plain, "src/renderer/app.ts");
  assert.equal(withoutProfile.status, 0, withoutProfile.output);
});

test("timeout overrides warn in unit tests and are ignored in end-to-end tests", (t) => {
  const root = fixture(t, { vitest: true, tests: ["e2e/**/*.ts"] });
  write(root, "src/slow.ts", "export function run(): number {\n  return 1;\n}\n");
  write(
    root,
    "src/slow.test.ts",
    'import { expect, it } from "vitest";\n\nimport { run } from "./slow";\n\nit(\n  "runs",\n  () => {\n    expect(run()).toBe(1);\n  },\n  10_000,\n);\n',
  );
  write(
    root,
    "e2e/flow.e2e.ts",
    'import { expect, test } from "@playwright/test";\n\ntest("opens", async ({ page }) => {\n  test.setTimeout(120_000);\n  await expect(page).toHaveTitle("App");\n});\n',
  );
  const unit = lint(root, "src/slow.test.ts");
  assert.equal(unit.status, 0, unit.output);
  assert.match(unit.output, /no-test-timeout-overrides/);
  const endToEnd = lint(root, "e2e/flow.e2e.ts");
  assert.equal(endToEnd.status, 0, endToEnd.output);
  assert.doesNotMatch(endToEnd.output, /no-test-timeout-overrides/);
});

test("production, unit-test and React rules stay in their scopes", (t) => {
  const root = fixture(t, { react: ["src/ui/**"] });

  const production =
    "export function stop(server: { close(done: () => void): void } | undefined) {\n  return new Promise((resolve) => server?.close(resolve));\n}\n\nexport async function load(url: string) {\n  const response = await fetch(url);\n\n  return response.json();\n}\n";

  const clockTest =
    'import { expect, test } from "vitest";\n\ntest("now", () => {\n  expect(Date.now()).toBeGreaterThan(0);\n});\n';

  const form =
    'export function SignIn() {\n  return (\n    <form>\n      <input type="password" />\n    </form>\n  );\n}\n';

  write(root, "src/server.ts", production);
  write(root, "src/server.test.ts", `${production}${clockTest}`);
  write(root, "e2e/clock.test.ts", clockTest);
  write(root, "src/ui/SignIn.tsx", form);
  write(root, "src/SignIn.tsx", form);

  const server = lint(root, "src/server.ts");
  assert.match(server.output, /no-unsettled-promise/);
  assert.match(server.output, /no-unchecked-fetch-response/);

  const unit = lint(root, "src/server.test.ts");
  assert.doesNotMatch(unit.output, /no-unsettled-promise|no-unchecked-fetch-response/);
  assert.match(unit.output, /no-uncontrolled-test-clock/);

  const endToEnd = lint(root, "e2e/clock.test.ts");
  assert.doesNotMatch(endToEnd.output, /no-uncontrolled-test-clock/);

  const forms = lint(root, "src/ui/SignIn.tsx", "src/SignIn.tsx");
  assert.equal(forms.output.match(/no-get-password-form/g)?.length, 1, forms.output);
});

test("a rule change applies where the preset enables the rule and keeps its options and exemptions", (t) => {
  const root = fixture(t, {
    rules: {
      "eslint/no-console": "warn",
      "eslint/no-unused-vars": "warn",
      "wyse/no-unchecked-fetch-response": "off",
    },
  });

  const logging = 'export function report(): void {\n  console.log("report");\n}\n';
  write(root, "src/report.ts", logging);
  write(root, "scripts/report.ts", logging);
  write(root, "src/unused.ts", "const _kept = 1;\nconst dropped = 2;\n\nexport const value = 3;\n");
  write(
    root,
    "src/load.ts",
    "export async function load(url: string) {\n  const response = await fetch(url);\n\n  return response.json();\n}\n",
  );

  const source = lint(root, "src/report.ts");
  assert.equal(source.status, 0, source.output);
  assert.match(source.output, /no-console/);
  assert.doesNotMatch(lint(root, "scripts/report.ts").output, /no-console/);

  const unused = lint(root, "src/unused.ts");
  assert.equal(unused.status, 0, unused.output);
  assert.match(unused.output, /dropped/);
  assert.doesNotMatch(unused.output, /_kept/);

  const load = lint(root, "src/load.ts");
  assert.equal(load.status, 0, load.output);
});

test("turning off a rule whose plugin is not loaded changes nothing", (t) => {
  const root = fixture(t, { rules: { "e18e/prefer-static-regex": "off" } });
  write(
    root,
    "src/add.ts",
    "export function add(left: number, right: number): number {\n  return left + right;\n}\n",
  );
  const result = lint(root, "src/add.ts");
  assert.equal(result.status, 0, result.output);
});

test("a rule the preset does not set applies where a profile loads its plugin", (t) => {
  const root = fixture(t, { react: ["src/ui/**"], rules: { "react/no-danger": "error" } });

  const source =
    "export function Markup({ html }: { html: string }) {\n  return <div dangerouslySetInnerHTML={{ __html: html }} />;\n}\n";

  write(root, "src/ui/Markup.tsx", source);
  write(root, "src/email/Markup.tsx", source);

  const ui = lint(root, "src/ui/Markup.tsx");
  assert.equal(ui.status, 1, ui.output);
  assert.match(ui.output, /no-danger/);

  const email = lint(root, "src/email/Markup.tsx");
  assert.doesNotMatch(email.output, /no-danger/);
});

test("a JavaScript plugin rule the preset does not set applies where a profile loads its plugin", (t) => {
  const root = fixture(t, {
    react: ["src/ui/**"],
    rules: { "e18e/prefer-exponentiation-operator": "error" },
  });

  const source =
    "export function squared(value: number): number {\n  return Math.pow(value, 2);\n}\n";

  write(root, "src/ui/squared.ts", source);
  write(root, "src/ui/squared.test.ts", source);
  write(root, "src/math/squared.ts", source);

  const ui = lint(root, "src/ui/squared.ts");
  assert.equal(ui.status, 1, ui.output);
  assert.match(ui.output, /e18e/);

  const elsewhere = lint(root, "src/ui/squared.test.ts", "src/math/squared.ts");
  assert.doesNotMatch(elsewhere.output, /e18e/);
});

test("a rule the preset turns off is changed where the preset sets it", (t) => {
  const root = fixture(t, {
    react: ["src/ui/**"],
    rules: { "jsx-a11y/prefer-tag-over-role": "error" },
  });

  const source = 'export function Banner() {\n  return <div role="banner">Site</div>;\n}\n';
  write(root, "src/ui/Banner.tsx", source);
  const result = lint(root, "src/ui/Banner.tsx");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /prefer-tag-over-role/);
});

test("project overrides and ignore patterns add to the preset's", (t) => {
  const root = fixture(t, {
    ignorePatterns: ["src/generated/**"],
    overrides: [{ files: ["src/validation/**"], rules: { "typescript/no-explicit-any": "off" } }],
  });

  for (const path of [
    "src/generated/api.ts",
    "dist/api.ts",
    "src/validation/parse.ts",
    "src/api.ts",
  ]) {
    write(root, path, "export const value: any = 1;\n");
  }

  const result = lint(root, ".");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /src\/api\.ts/);
  assert.doesNotMatch(result.output, /generated|dist|validation/);
});

test("a project override changes a framework rule for its files", (t) => {
  const root = fixture(t, {
    react: true,
    overrides: [
      {
        files: ["src/legacy/**"],
        plugins: ["react", "jsx-a11y"],
        rules: { "jsx-a11y/no-autofocus": "off" },
      },
    ],
  });

  const source = "export function Search() {\n  return <input autoFocus />;\n}\n";
  write(root, "src/legacy/Search.tsx", source);
  write(root, "src/Search.tsx", source);
  const legacy = lint(root, "src/legacy/Search.tsx");
  assert.equal(legacy.status, 0, legacy.output);
  const current = lint(root, "src/Search.tsx");
  assert.equal(current.status, 1, current.output);
  assert.match(current.output, /no-autofocus/);
});

test("extra formatter ignore patterns add to the shared ones", (t) => {
  const root = fixture(t);
  const config = createFormatConfig({ ignorePatterns: ["generated/**"] });
  write(root, "oxfmt.config.ts", `export default ${JSON.stringify(config)};\n`);
  write(root, "dist/value.ts", "export const value=1\n");
  write(root, "generated/value.ts", "export const value=1\n");
  write(root, "src/value.ts", "export const value = 1;\n");
  const ignored = run(root, formatBin, ["--check", "dist", "generated", "src"]);
  assert.equal(ignored.status, 0, ignored.output);
  write(root, "src/other.ts", "export const value=1\n");
  const checked = run(root, formatBin, ["--check", "dist", "generated", "src"]);
  assert.equal(checked.status, 1, checked.output);
  assert.match(checked.output, /src\/other\.ts/);
});

test("import sorting can be turned off", (t) => {
  const root = fixture(t);
  const config = createFormatConfig({ sortImports: false });
  write(root, "oxfmt.config.ts", `export default ${JSON.stringify(config)};\n`);

  const unsorted =
    'import { z } from "zod";\nimport { useState } from "react";\n\nexport { useState, z };\n';

  write(root, "imports.ts", unsorted);
  const result = run(root, formatBin, ["imports.ts"]);
  assert.equal(result.status, 0, result.output);
  assert.equal(readFileSync(join(root, "imports.ts"), "utf8"), unsorted);
});
