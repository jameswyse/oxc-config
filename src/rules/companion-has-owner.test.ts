import assert from "node:assert/strict";
import { mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { after, test } from "node:test";

import { lint, temporaryProject, write } from "../shared/config.test-utils.ts";
import { lintNow, ruleTester } from "../shared/rule-tester.ts";
import { companionHasOwner } from "./companion-has-owner.ts";

import type { RuleTester } from "oxlint/plugins-dev";

const root = mkdtempSync(join(tmpdir(), "companion-has-owner-"));

after(() => rmSync(root, { recursive: true, force: true }));

const moduleContents = "export const value = 1;\n";

const lintedExtensions = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

type ProjectFile = string | readonly [path: string, contents: string];

type ExpectedError =
  | { readonly messageId: "owner"; readonly data: { readonly owner: string } }
  | { readonly messageId: "detached"; readonly data: { readonly directory: string } };

function noOwner(owner: string) {
  return { messageId: "owner", data: { owner } } satisfies ExpectedError;
}

function detached(directory: string) {
  return { messageId: "detached", data: { directory } } satisfies ExpectedError;
}

function fileEntry(file: ProjectFile) {
  return typeof file === "string" ? ([file, moduleContents] as const) : file;
}

function scenario(
  description: string,
  files: readonly ProjectFile[],
  expected: Readonly<Record<string, readonly ExpectedError[]>> = {},
) {
  const directory = mkdtempSync(join(root, "project-"));
  const valid: RuleTester.ValidTestCase[] = [];
  const invalid: RuleTester.InvalidTestCase[] = [];

  for (const file of files) {
    const [path, code] = fileEntry(file);
    write(directory, path, code);

    if (!lintedExtensions.has(extname(path))) {
      continue;
    }

    const testCase = {
      name: `${description}: ${path}`,
      code,
      cwd: directory,
      filename: join(directory, path),
    };

    const errors = expected[path];

    if (errors === undefined) {
      valid.push(testCase);
    } else {
      invalid.push({
        ...testCase,
        errors: errors.map(({ messageId, data }) => ({
          messageId,
          data: { name: basename(path), ...data },
        })),
      });
    }
  }

  const unusedExpectations = Object.keys(expected).filter(
    (path) => !invalid.some(({ filename }) => filename === join(directory, path)),
  );

  if (unusedExpectations.length > 0) {
    throw new Error(
      `${description} expects errors for files it does not lint: ${unusedExpectations.join(", ")}`,
    );
  }

  return { valid, invalid };
}

const aliasHelper = 'import { render } from "../test-utils/render";\n';

const sideEffectHelper = 'import "../test-utils/render";\n';

const scenarios = [
  scenario("companions with a sibling owner", [
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
  scenario(
    "companions without an owner",
    [
      "src/quote/Quote.tsx",
      "src/quote/Quote.helper.test.ts",
      "src/quote/OldQuote.test.tsx",
      "src/quote/QuoteHistory.test.tsx",
      "src/quote/Quote-history.test.tsx",
      "src/quote/Quote.history.ts",
      "src/quote/Pricing.stories.tsx",
    ],
    {
      "src/quote/OldQuote.test.tsx": [noOwner("OldQuote")],
      "src/quote/Quote-history.test.tsx": [noOwner("Quote-history")],
      "src/quote/QuoteHistory.test.tsx": [noOwner("QuoteHistory")],
    },
  ),
  scenario(
    "another companion as the only sibling",
    ["src/quote/Quote.test.tsx", "src/quote/Quote.stories.tsx"],
    { "src/quote/Quote.test.tsx": [noOwner("Quote")] },
  ),
  scenario("integration tests and test directories", [
    "src/checkout/checkoutFlow.integration.test.ts",
    "src/checkout/checkoutFlow.e2e.spec.ts",
    "src/components/__tests__/DayWeekParity.test.tsx",
    "tests/browser/quote.spec.ts",
  ]),
  scenario(
    "tests that only import modules outside their home",
    [
      "src/a/a.ts",
      "src/b/b.ts",
      "src/b/index.ts",
      ["src/a/a.test.ts", 'import { b } from "../b/b";\n'],
      ["src/a/__tests__/a.test.ts", 'import { b } from "../../b";\n'],
    ],
    {
      "src/a/a.test.ts": [detached("src/b")],
      "src/a/__tests__/a.test.ts": [detached("src/b")],
    },
  ),
  scenario(
    "the first resolved import",
    [
      "src/a/a.ts",
      "src/b/b.ts",
      "src/c/c.ts",
      [
        "src/a/a.test.ts",
        'import "../missing";\nimport { c } from "../c/c";\nimport { b } from "../b/b";\n',
      ],
    ],
    { "src/a/a.test.ts": [detached("src/c")] },
  ),
  scenario(
    "every value import form",
    [
      "src/a/a.ts",
      "src/b/b.ts",
      "src/b/view.tsx",
      "src/b/worker.mts",
      "src/b/legacy.cts",
      "src/b/data.json",
      "src/c/index.ts",
      ["src/a/a.side.test.ts", 'import "../b/b";\n'],
      ["src/a/a.all.test.ts", 'export * from "../b/b";\n'],
      ["src/a/a.named.test.ts", 'export { b } from "../b/b";\n'],
      ["src/a/a.dynamic.test.ts", 'await import("../b/b");\n'],
      ["src/a/a.template.test.ts", "await import(`../b/b`);\n"],
      ["src/a/a.js.test.ts", 'import { b } from "../b/b.js";\n'],
      ["src/a/a.jsx.test.tsx", 'import { view } from "../b/view.jsx";\n'],
      ["src/a/a.mjs.test.ts", 'import { worker } from "../b/worker.mjs";\n'],
      ["src/a/a.cjs.test.ts", 'import { legacy } from "../b/legacy.cjs";\n'],
      ["src/a/a.json.test.ts", 'import data from "../b/data.json";\n'],
      ["src/a/a.index.test.ts", 'import { c } from "../c";\n'],
      ["src/a/a.mixed.test.ts", 'import { type B, b } from "../b/b";\n'],
      ["src/a/a.require.test.cjs", 'require("../b/b");\n'],
      ["src/a/a.require-template.test.cjs", "require(`../b/b`);\n"],
    ],
    {
      "src/a/a.side.test.ts": [detached("src/b")],
      "src/a/a.all.test.ts": [detached("src/b")],
      "src/a/a.named.test.ts": [detached("src/b")],
      "src/a/a.dynamic.test.ts": [detached("src/b")],
      "src/a/a.template.test.ts": [detached("src/b")],
      "src/a/a.js.test.ts": [detached("src/b")],
      "src/a/a.jsx.test.tsx": [detached("src/b")],
      "src/a/a.mjs.test.ts": [detached("src/b")],
      "src/a/a.cjs.test.ts": [detached("src/b")],
      "src/a/a.json.test.ts": [detached("src/b")],
      "src/a/a.index.test.ts": [detached("src/c")],
      "src/a/a.mixed.test.ts": [detached("src/b")],
      "src/a/a.require.test.cjs": [detached("src/b")],
      "src/a/a.require-template.test.cjs": [detached("src/b")],
    },
  ),
  scenario("a require that is not the global require", [
    "src/a/a.ts",
    "src/b/b.ts",
    [
      "src/a/a.local.test.ts",
      'import { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);\nrequire("../b/b");\n',
    ],
    ["src/a/a.computed.test.cjs", 'const path = "../b/b";\nrequire(path);\n'],
    ["src/a/a.member.test.cjs", 'module.require("../b/b");\n'],
  ]),
  scenario("tests that import a module directly in their home", [
    "src/a/a.ts",
    "src/a/index.ts",
    "src/shared/fixture.ts",
    "root.ts",
    ["src/a/a.test.ts", 'import { a } from "./a";\nimport { fixture } from "../shared/fixture";\n'],
    ["src/a/__tests__/a.test.ts", 'import { a } from "../a";\n'],
    ["src/a/__tests__/a.parent.test.ts", 'import { a } from "..";\n'],
    ["src/a/a.dot.test.ts", 'import { a } from ".";\n'],
    ["tests/unit/root.test.ts", 'import { root } from "../../root";\n'],
  ]),
  scenario(
    "tests that import only modules deeper than their home",
    [
      "src/a/a.ts",
      "src/a/nested/thing.ts",
      "src/c/index.ts",
      "src/checkout.ts",
      "src/index.ts",
      ["src/a/a.nested.test.ts", 'import { thing } from "./nested/thing";\n'],
      ["src/c.test.ts", 'import { c } from "./c";\n'],
      ["src/a/a.parent.test.ts", 'import { root } from "..";\n'],
      ["tests/unit/checkout.test.ts", 'import { checkout } from "../../src/checkout";\n'],
      ["tests/checkout.test.ts", 'import { checkout } from "../src/checkout";\n'],
    ],
    {
      "src/a/a.nested.test.ts": [detached("src/a/nested")],
      "src/c.test.ts": [detached("src/c")],
      "src/a/a.parent.test.ts": [detached("src")],
      "tests/unit/checkout.test.ts": [detached("src")],
      "tests/checkout.test.ts": [detached("src")],
    },
  ),
  scenario("imports the rule cannot place on disk", [
    "src/a/a.ts",
    "src/b/b.ts",
    "src/b/empty/.keep",
    "node_modules/vitest/package.json",
    [
      "src/a/a.packages.test.ts",
      'import { test } from "vitest";\nimport { readFile } from "node:fs/promises";\n',
    ],
    ["src/a/a.missing.test.ts", 'import { gone } from "../b/gone";\n'],
    ["src/a/a.folder.test.ts", 'import "../b/empty";\n'],
    ["src/a/a.computed.test.ts", 'const path = "../b/b";\nawait import(path);\n'],
    ["src/a/a.nul.test.ts", 'import "./a\\0b";\nimport "\\0virtual";\n'],
  ]),
  scenario("tests that also import through a path alias", [
    "src/a/a.ts",
    "src/test-utils/render.ts",
    ["src/a/a.at.test.ts", `import { a } from "@/a/a";\n${aliasHelper}`],
    ["src/a/a.tilde.test.ts", `import { a } from "~/a/a";\n${aliasHelper}`],
    ["src/a/a.hash.test.ts", `import { a } from "#a/a";\n${aliasHelper}`],
    ["src/a/a.dollar.test.ts", `import { a } from "$lib/a/a";\n${aliasHelper}`],
    ["src/a/a.src.test.ts", `import { a } from "src/a/a";\n${aliasHelper}`],
    ["src/a/a.scoped.test.ts", `import { a } from "@app/cart";\n${aliasHelper}`],
    ["src/a/a.bare.test.ts", `import { a } from "cart/a";\n${aliasHelper}`],
    ["src/a/a.dynamic.test.ts", `await import("@app/cart");\n${aliasHelper}`],
    ["src/a/a.require.test.cjs", 'require("@app/cart");\nrequire("../test-utils/render");\n'],
  ]),
  scenario(
    "installed packages, built-ins, URLs and type-only imports",
    [
      "src/a/a.ts",
      "src/test-utils/render.ts",
      "node_modules/vitest/package.json",
      "node_modules/@testing-library/react/package.json",
      ["src/a/a.vitest.test.ts", `import { test } from "vitest";\n${sideEffectHelper}`],
      [
        "src/a/a.scoped.test.ts",
        `import { render } from "@testing-library/react/pure";\n${sideEffectHelper}`,
      ],
      ["src/a/a.node.test.ts", `import { readFile } from "node:fs/promises";\n${sideEffectHelper}`],
      ["src/a/a.builtin.test.ts", `import { readFile } from "fs/promises";\n${sideEffectHelper}`],
      ["src/a/a.bun.test.ts", `import { test } from "bun:test";\n${sideEffectHelper}`],
      ["src/a/a.type.test.ts", `import type { Cart } from "@app/cart";\n${sideEffectHelper}`],
    ],
    {
      "src/a/a.vitest.test.ts": [detached("src/test-utils")],
      "src/a/a.scoped.test.ts": [detached("src/test-utils")],
      "src/a/a.node.test.ts": [detached("src/test-utils")],
      "src/a/a.builtin.test.ts": [detached("src/test-utils")],
      "src/a/a.bun.test.ts": [detached("src/test-utils")],
      "src/a/a.type.test.ts": [detached("src/test-utils")],
    },
  ),
  scenario(
    "tests that import their own package by name",
    [
      ["package.json", JSON.stringify({ name: "@acme/toolkit" })],
      "node_modules/@acme/toolkit/package.json",
      "node_modules/@acme/toolkit-extra/package.json",
      "src/a/a.ts",
      "src/test-utils/render.ts",
      ["src/a/a.self.test.ts", `import { a } from "@acme/toolkit";\n${aliasHelper}`],
      ["src/a/a.subpath.test.ts", `import { query } from "@acme/toolkit/query";\n${aliasHelper}`],
      ["src/a/a.lookalike.test.ts", `import { extra } from "@acme/toolkit-extra";\n${aliasHelper}`],
    ],
    { "src/a/a.lookalike.test.ts": [detached("src/test-utils")] },
  ),
  scenario("type-only imports and exports", [
    "src/a/a.ts",
    "src/b/b.ts",
    [
      "src/a/a.types.test.ts",
      'import type { B } from "../b/b";\nimport { type C } from "../b/b";\nexport type { D } from "../b/b";\nexport { type E } from "../b/b";\nexport type * from "../b/b";\n',
    ],
  ]),
  scenario("integration and end-to-end tests", [
    "src/a/a.ts",
    "src/b/b.ts",
    ["src/a/a.integration.test.ts", 'import { b } from "../b/b";\n'],
    ["src/a/a.e2e.spec.ts", 'import { b } from "../b/b";\n'],
    ["e2e/login.spec.ts", 'import { b } from "../src/b/b";\n'],
    ["src/a/e2e/a.test.ts", 'import { b } from "../../b/b";\n'],
    ["src/a/__e2e__/a.test.ts", 'import { b } from "../../b/b";\n'],
  ]),
  scenario(
    "a test with no owner that imports from elsewhere",
    ["src/b/b.ts", ["src/a/b.test.ts", 'import { b } from "../b/b";\n']],
    { "src/a/b.test.ts": [noOwner("b"), detached("src/b")] },
  ),
];

test("a scenario rejects expected errors for a file it does not lint", () => {
  assert.throws(
    () =>
      scenario("a misspelt expectation", ["src/quote/Quote.test.ts", "src/quote/Quote.json"], {
        "src/quote/Qoute.test.ts": [noOwner("Qoute")],
        "src/quote/Quote.json": [noOwner("Quote")],
      }),
    { message: /src\/quote\/Qoute\.test\.ts, src\/quote\/Quote\.json/ },
  );
});

ruleTester.run("companion-has-owner", companionHasOwner, {
  valid: scenarios.flatMap(({ valid }) => valid),
  invalid: scenarios.flatMap(({ invalid }) => invalid),
});

const priceTest = 'import { local } from "./local";\nimport { other } from "../other/other";\n';

function priceProject(directory: string) {
  write(directory, "src/quote/price.ts", moduleContents);
  write(directory, "src/quote/local.ts", moduleContents);
  write(directory, "src/other/other.ts", moduleContents);
  write(directory, "src/quote/price.test.ts", priceTest);

  return { code: priceTest, cwd: directory, filename: join(directory, "src/quote/price.test.ts") };
}

test("deleting the only local import between lints reports the test as detached", (t) => {
  const directory = temporaryProject(t);
  const testCase = priceProject(directory);

  lintNow("companion-has-owner", companionHasOwner, { valid: [testCase], invalid: [] });
  unlinkSync(join(directory, "src/quote/local.ts"));
  lintNow("companion-has-owner", companionHasOwner, {
    valid: [],
    invalid: [
      {
        ...testCase,
        errors: [
          { messageId: "detached", data: { name: "price.test.ts", directory: "src/other" } },
        ],
      },
    ],
  });
});

test("deleting the owner between lints reports the missing owner", (t) => {
  const directory = temporaryProject(t);
  const testCase = priceProject(directory);

  lintNow("companion-has-owner", companionHasOwner, { valid: [testCase], invalid: [] });
  unlinkSync(join(directory, "src/quote/price.ts"));
  lintNow("companion-has-owner", companionHasOwner, {
    valid: [],
    invalid: [
      {
        ...testCase,
        errors: [{ messageId: "owner", data: { name: "price.test.ts", owner: "price" } }],
      },
    ],
  });
});

test("renaming the package between lints changes which imports name the package", (t) => {
  const directory = temporaryProject(t);
  const code = `import { a } from "@acme/toolkit";\n${aliasHelper}`;
  write(directory, "package.json", JSON.stringify({ name: "@acme/old" }));
  write(directory, "node_modules/@acme/toolkit/package.json", "{}");
  write(directory, "src/a/a.ts", moduleContents);
  write(directory, "src/test-utils/render.ts", moduleContents);
  write(directory, "src/a/a.self.test.ts", code);
  const testCase = { code, cwd: directory, filename: join(directory, "src/a/a.self.test.ts") };

  lintNow("companion-has-owner", companionHasOwner, {
    valid: [],
    invalid: [
      {
        ...testCase,
        errors: [
          { messageId: "detached", data: { name: "a.self.test.ts", directory: "src/test-utils" } },
        ],
      },
    ],
  });
  write(directory, "package.json", JSON.stringify({ name: "@acme/toolkit" }));
  lintNow("companion-has-owner", companionHasOwner, { valid: [testCase], invalid: [] });
});

test("the oxlint CLI reports companions through the plugin", (t) => {
  const directory = temporaryProject(t);
  write(
    directory,
    "plugin.mjs",
    `import { companionHasOwner } from ${JSON.stringify(new URL("./companion-has-owner.ts", import.meta.url).href)};\nexport default { meta: { name: "local" }, rules: { "companion-has-owner": companionHasOwner } };\n`,
  );
  write(
    directory,
    ".oxlintrc.json",
    JSON.stringify({
      categories: { correctness: "off" },
      plugins: [],
      jsPlugins: [{ name: "local", specifier: "./plugin.mjs" }],
      rules: { "local/companion-has-owner": "error" },
    }),
  );
  write(directory, "src/quote/Quote.ts", moduleContents);
  write(directory, "src/quote/Quote.test.ts", 'import { value } from "./Quote";\n');
  write(directory, "src/quote/OldQuote.test.ts", 'import { value } from "./Quote";\n');

  const { output } = lint(directory, "-c", ".oxlintrc.json", "src");

  assert.match(output, /"filename":\s*"src\/quote\/OldQuote\.test\.ts"/);
  assert.doesNotMatch(output, /"filename":\s*"src\/quote\/Quote\.test\.ts"/);
});
