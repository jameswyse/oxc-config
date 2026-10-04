import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test, type TestContext } from "node:test";

const require = createRequire(import.meta.url);

const lintBin = join(dirname(require.resolve("oxlint/package.json")), "bin/oxlint");

const ruleUrl = new URL("./companion-has-owner.ts", import.meta.url).href;

function write(root: string, path: string, contents = "export const value = 1;\n"): void {
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

function findings(t: TestContext, files: string[]): string[] {
  const root = mkdtempSync(join(tmpdir(), "companion-has-owner-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  write(
    root,
    "plugin.mjs",
    `import { companionHasOwner } from ${JSON.stringify(ruleUrl)};\nexport default { meta: { name: "local" }, rules: { "companion-has-owner": companionHasOwner } };\n`,
  );
  write(
    root,
    "oxlint.json",
    JSON.stringify({
      categories: { correctness: "off" },
      plugins: [],
      jsPlugins: [{ name: "local", specifier: "./plugin.mjs" }],
      rules: { "local/companion-has-owner": "error" },
    }),
  );

  for (const file of files) {
    write(root, file);
  }

  const result = spawnSync(
    process.execPath,
    [lintBin, "-c", "oxlint.json", "--format", "json", "src", "tests"],
    { cwd: root, encoding: "utf8" },
  );

  assert.ifError(result.error);

  const report: unknown = JSON.parse(result.stdout);
  assert.ok(isLintReport(report), result.stdout);

  return report.diagnostics.map((diagnostic) => diagnostic.filename).toSorted();
}

test("companions with a sibling owner pass", (t) => {
  assert.deepEqual(
    findings(t, [
      "src/quote/Quote.tsx",
      "src/quote/Quote.test.tsx",
      "src/quote/Quote.history.test.tsx",
      "src/quote/quote.schema.ts",
      "src/quote/quote.schema.spec.ts",
      "src/quote/Price.bench.ts",
      "src/quote/Price/index.ts",
      "src/quote/QuoteSummary.json",
      "src/quote/QuoteSummary.test.ts",
      "src/quote/quote.test.ts",
    ]),
    [],
  );
});

test("companions without an owner are reported", (t) => {
  assert.deepEqual(
    findings(t, [
      "src/quote/Quote.tsx",
      "src/quote/Quote.helper.test.ts",
      "src/quote/OldQuote.test.tsx",
      "src/quote/QuoteHistory.test.tsx",
      "src/quote/Quote-history.test.tsx",
      "src/quote/Quote.history.ts",
      "src/quote/Pricing.stories.tsx",
    ]),
    [
      "src/quote/OldQuote.test.tsx",
      "src/quote/Quote-history.test.tsx",
      "src/quote/QuoteHistory.test.tsx",
    ],
  );
});

test("another companion does not count as an owner", (t) => {
  assert.deepEqual(findings(t, ["src/quote/Quote.test.tsx", "src/quote/Quote.stories.tsx"]), [
    "src/quote/Quote.test.tsx",
  ]);
});

test("integration tests and test directories need no single owner", (t) => {
  assert.deepEqual(
    findings(t, [
      "src/checkout/checkoutFlow.integration.test.ts",
      "src/checkout/checkoutFlow.e2e.spec.ts",
      "src/components/__tests__/DayWeekParity.test.tsx",
      "tests/browser/quote.spec.ts",
    ]),
    [],
  );
});
