import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

import type { LintOptions } from "./lint.ts";

const require = createRequire(import.meta.url);

const lintBin = join(dirname(require.resolve("oxlint/package.json")), "bin/oxlint");

const formatBin = join(dirname(require.resolve("oxfmt/package.json")), "bin/oxfmt");

const lintUrl = new URL("./lint.ts", import.meta.url).href;

const formatUrl = new URL("./format.ts", import.meta.url).href;

function write(root: string, path: string, contents: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

function fixture(t: TestContext, options: LintOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), "oxc-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  write(
    root,
    "oxlint.config.ts",
    `import { createLintConfig } from ${JSON.stringify(lintUrl)};\nexport default createLintConfig(${JSON.stringify({ typeAware: false, ...options })});\n`,
  );
  write(
    root,
    "oxfmt.config.ts",
    `import { formatConfig } from ${JSON.stringify(formatUrl)};\nexport default formatConfig;\n`,
  );

  return root;
}

function run(root: string, bin: string, args: string[]) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd: root, encoding: "utf8" });
  assert.ifError(result.error);

  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

function lint(root: string, ...args: string[]) {
  return run(root, lintBin, ["--format", "json", ...args]);
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
  symlinkSync(new URL("../node_modules", import.meta.url), join(root, "node_modules"), "junction");
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
    'import { expect, it } from "vitest";\n\nimport { stamp } from "./order";\n\nit("stamps", () => {\n  expect(stamp()).not.toBe(`${Date.now()}`);\n});\n',
  );
  const owners = lint(root, "src/clock.ts", "src/ids.ts", "src/order.test.ts");
  assert.equal(owners.status, 0, owners.output);
  const order = lint(root, "src/order.ts");
  assert.equal(order.status, 1, order.output);
  assert.match(order.output, /no-ambient-clock/);
  assert.match(order.output, /no-ambient-random/);
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
