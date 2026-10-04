import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

const require = createRequire(import.meta.url);

const lintBin = join(dirname(require.resolve("oxlint/package.json")), "bin/oxlint");

const ruleUrl = new URL("./no-forwarding-module.ts", import.meta.url).href;

function write(root: string, path: string, contents: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

interface LintReport {
  diagnostics: { filename: string }[];
}

function isLintReport(value: unknown): value is LintReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "diagnostics" in value &&
    Array.isArray(value.diagnostics) &&
    value.diagnostics.every(
      (diagnostic: unknown) =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "filename" in diagnostic &&
        typeof diagnostic.filename === "string",
    )
  );
}

function findings(t: TestContext, files: Record<string, string>): string[] {
  const root = mkdtempSync(join(tmpdir(), "no-forwarding-module-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  write(
    root,
    "plugin.mjs",
    `import { noForwardingModule } from ${JSON.stringify(ruleUrl)};\nexport default { meta: { name: "local" }, rules: { "no-forwarding-module": noForwardingModule } };\n`,
  );
  write(
    root,
    "oxlint.json",
    JSON.stringify({
      categories: { correctness: "off" },
      plugins: [],
      jsPlugins: [{ name: "local", specifier: "./plugin.mjs" }],
      rules: { "local/no-forwarding-module": "error" },
    }),
  );

  for (const [path, contents] of Object.entries(files)) {
    write(root, path, contents);
  }

  const result = spawnSync(
    process.execPath,
    [lintBin, "-c", "oxlint.json", "--format", "json", "apps", "packages"],
    { cwd: root, encoding: "utf8" },
  );

  assert.ifError(result.error);

  const report: unknown = JSON.parse(result.stdout);
  assert.ok(isLintReport(report), result.stdout);

  return report.diagnostics.map((diagnostic) => diagnostic.filename).toSorted();
}

const app = { "apps/web/package.json": JSON.stringify({ name: "web", private: true }) };

test("application modules that only re-export are reported", (t) => {
  assert.deepEqual(
    findings(t, {
      ...app,
      "apps/web/src/all.ts": 'export * from "./quote";\nexport * as price from "./price";\n',
      "apps/web/src/named.ts": 'export { quote } from "./quote";\n',
      "apps/web/src/types.ts": 'export type { Quote } from "./quote";\n',
      "apps/web/src/rebound.ts":
        'import { quote } from "./quote";\nimport price from "./price";\nexport { quote as current };\nexport default price;\n',
      "apps/web/src/components/Grid/index.ts": 'export { Grid } from "./Grid";\n',
    }),
    [
      "apps/web/src/all.ts",
      "apps/web/src/components/Grid/index.ts",
      "apps/web/src/named.ts",
      "apps/web/src/rebound.ts",
      "apps/web/src/types.ts",
    ],
  );
});

test("modules that own behaviour or change a binding pass", (t) => {
  assert.deepEqual(
    findings(t, {
      ...app,
      "apps/web/src/client.ts": '"use client";\nexport { Dialog } from "./dialog";\n',
      "apps/web/src/styled.ts": 'import "./styles.css";\nexport { Button } from "./button";\n',
      "apps/web/src/derived.ts":
        'import { quote } from "./quote";\nexport { quote };\nexport const price = quote.price;\n',
      "apps/web/src/unused.ts": 'import { quote, price } from "./quote";\nexport { quote };\n',
      "apps/web/src/empty.ts": "export {};\n",
    }),
    [],
  );
});

test("package entrypoints declared in the nearest manifest pass", (t) => {
  assert.deepEqual(
    findings(t, {
      "packages/ui/package.json": JSON.stringify({
        name: "ui",
        exports: {
          ".": { source: "./src/index.ts", default: "./dist/index.js" },
          "./icons/*": "./src/icons/*.ts",
        },
      }),
      "packages/ui/src/index.ts": 'export * from "./button";\n',
      "packages/ui/src/icons/close.ts": 'export { Close } from "../generated/close";\n',
      "packages/ui/src/internal.ts": 'export { Button } from "./button";\n',
      "packages/legacy/package.json": JSON.stringify({ name: "legacy", main: "./lib/main.js" }),
      "packages/legacy/lib/main.js": 'export * from "./api.js";\n',
      "packages/implicit/package.json": JSON.stringify({ name: "implicit" }),
      "packages/implicit/index.js": 'export * from "./api.js";\n',
    }),
    ["packages/ui/src/internal.ts"],
  );
});

test("framework route files pass only at their framework location", (t) => {
  assert.deepEqual(
    findings(t, {
      ...app,
      "apps/web/src/app/diagnostics/page.tsx":
        'export { DiagnosticsRoute as default, metadata } from "@/features/diagnostics/route";\n',
      "apps/web/src/app/api/draft/route.ts": 'export { GET } from "@/features/draft/handler";\n',
      "apps/web/src/pages/about.tsx": 'export { default } from "@/features/about/page";\n',
      "apps/web/src/middleware.ts": 'export { middleware, config } from "@/platform/middleware";\n',
      "apps/web/src/features/app/page.tsx": 'export { default } from "./view";\n',
      "apps/web/src/features/middleware.ts": 'export { middleware } from "./proxy";\n',
    }),
    ["apps/web/src/features/app/page.tsx", "apps/web/src/features/middleware.ts"],
  );
});
