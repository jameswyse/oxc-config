import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { lint, temporaryProject, write } from "../shared/config.test-utils.ts";
import { lintNow, ruleTester } from "../shared/rule-tester.ts";
import { noWildcardSourceExports } from "./no-wildcard-source-exports.ts";

const root = mkdtempSync(join(tmpdir(), "no-wildcard-source-exports-"));

after(() => rmSync(root, { recursive: true, force: true }));

const code = "export const value = 1;";

const descriptions = new Map<string, string>();

function project(manifests: Record<string, string>) {
  const directory = join(root, String(descriptions.size));
  descriptions.set(directory, JSON.stringify(manifests));

  for (const [path, contents] of Object.entries(manifests)) {
    write(directory, path, contents);
  }

  return directory;
}

function packageWith(exports: unknown) {
  return project({ "package.json": JSON.stringify({ name: "pkg", exports }) });
}

function file(directory: string, path: string) {
  return {
    name: `${path} in ${descriptions.get(directory) ?? "a directory without package.json"}`,
    code,
    cwd: directory,
    filename: join(directory, path),
  };
}

function exposed(directory: string, path: string, subpath: string, target: string) {
  return {
    ...file(directory, path),
    errors: [{ messageId: "exposed", data: { subpath, target } }],
  };
}

const rootWildcard = packageWith({ "./*": "./*" });
const sourceWildcard = packageWith({ ".": "./src/index.ts", "./*": "./src/*.ts" });
const extensionWildcard = packageWith({ "./*": "./*.ts" });

const conditions = packageWith({
  "./*": {
    types: "./dist/*.d.ts",
    import: { development: "./src/*.tsx", default: "./dist/*.js" },
  },
});

const nullCondition = packageWith({ "./*": { node: null, default: "./src/*.ts" } });

const conditionAfterDefault = packageWith({
  "./*": { default: "./dist/*.js", development: "./src/*.ts" },
});

const nestedConditionAfterDefault = packageWith({
  "./*": { import: { default: "./dist/*.js", development: "./src/*.ts" } },
});

const unresolvedNestedDefault = packageWith({
  "./*": { default: { browser: "./dist/*.js" }, node: "./src/*.ts" },
});

const nullDefaultBeforeCondition = packageWith({
  "./*": { default: null, development: "./src/*.ts" },
});

const conditionalFirst = packageWith({ "./*": [{ browser: "./dist/*.js" }, "./src/*.ts"] });
const nullDefaultFirst = packageWith({ "./*": [{ default: null }, "./src/*.ts"] });

const defaultFirst = packageWith({
  "./*": [{ browser: "./dist/*.js", default: "./dist/*.js" }, "./src/*.ts"],
});

const fallbackDefaultFirst = packageWith({
  "./*": [{ browser: "./dist/*.js", default: ["src/*.ts", "./dist/*.js"] }, "./src/*.ts"],
});

const builtFirst = packageWith({ "./*": ["./dist/*.js", "./src/*.ts"] });
const invalidFirst = packageWith({ "./*": ["src/*.ts", "./src/*.ts"] });
const blockedNamespace = packageWith({ "./*": "./src/*.ts", "./internal/*": null });
const blockedExtension = packageWith({ "./*": "./src/*", "./*.js": null });
const blockedExact = packageWith({ "./*": "./src/*.ts", "./config": null });
const scopedNamespace = packageWith({ "./*": "./src/*.ts", "./icons/*": "./src/icons/*.ts" });
const renamedSubpath = packageWith({ "./utils/*": "./src/*.ts" });
const libraryRoot = packageWith({ "./*": "./lib/*.ts" });
const sourceRoot = packageWith({ "./*": "./source/*.js" });

const workspace = project({
  "package.json": JSON.stringify({ private: true }),
  "packages/ui/package.json": JSON.stringify({ exports: { "./*": "./src/*.ts" } }),
});

const shielded = project({
  "package.json": JSON.stringify({ exports: { "./*": "./*" } }),
  "packages/ui/package.json": JSON.stringify({ exports: "./src/button.ts" }),
});

const broken = project({
  "package.json": JSON.stringify({ exports: { "./*": "./*" } }),
  "packages/broken/package.json": "{ not json",
  "packages/scalar/package.json": '"./src/*.ts"',
});

ruleTester.run("no-wildcard-source-exports", noWildcardSourceExports, {
  valid: [
    file(sourceWildcard, "scripts/build.mjs"),
    file(extensionWildcard, "src/icons/arrow.tsx"),
    file(conditions, "src/index.ts"),
    file(builtFirst, "src/index.ts"),
    file(builtFirst, "dist/index.js"),
    file(conditionAfterDefault, "src/index.ts"),
    file(nestedConditionAfterDefault, "src/index.ts"),
    file(nullDefaultBeforeCondition, "src/index.ts"),
    file(defaultFirst, "src/index.ts"),
    file(fallbackDefaultFirst, "src/index.ts"),
    file(packageWith({ "./*": "src/*" }), "src/index.ts"),
    file(packageWith({ "./*": "./node_modules/*" }), "node_modules/dep/index.ts"),
    file(packageWith({ "./*": "././*" }), "index.ts"),
    file(packageWith({ "./*": "./../*" }), "index.ts"),
    file(blockedNamespace, "src/internal/cache.ts"),
    file(blockedExtension, "src/cache.js"),
    file(blockedExact, "src/config.ts"),
    file(scopedNamespace, "src/icons/arrow.ts"),
    file(packageWith({ "./*": "./dist/*.js" }), "dist/index.js"),
    file(packageWith({ "./*": "./build/*" }), "build/index.js"),
    file(packageWith({ "./*": "./out/*" }), "out/index.js"),
    file(packageWith({ "./*": "./esm/*.js" }), "esm/index.js"),
    file(packageWith({ "./*": "./cjs/*.js" }), "cjs/index.js"),
    file(packageWith({ "./*": "./.output/*" }), ".output/server.mjs"),
    file(packageWith({ "./icons/*": "./src/icons/*.tsx" }), "src/icons/arrow.tsx"),
    file(
      packageWith({
        ".": { types: "./src/index.ts", default: "./dist/index.js" },
        "./package.json": "./package.json",
      }),
      "src/index.ts",
    ),
    file(packageWith("./src/index.ts"), "src/index.ts"),
    file(packageWith(["./src/*.ts"]), "src/index.ts"),
    file(packageWith({ import: "./src/*.ts", "./utils": "./src/*.ts" }), "src/index.ts"),
    file(packageWith(undefined), "src/index.ts"),
    file(workspace, "src/index.ts"),
    file(shielded, "packages/ui/src/button.ts"),
    file(broken, "packages/broken/src/a.ts"),
    file(broken, "packages/scalar/src/b.ts"),
    file(join(root, "no-manifest"), "src/index.ts"),
  ],
  invalid: [
    exposed(rootWildcard, "index.ts", "./*", "./*"),
    exposed(rootWildcard, "scripts/build.mjs", "./*", "./*"),
    exposed(rootWildcard, "src/internal/cache.ts", "./*", "./*"),
    exposed(sourceWildcard, "src/index.ts", "./*", "./src/*.ts"),
    exposed(sourceWildcard, "src/internal/cache.ts", "./*", "./src/*.ts"),
    exposed(extensionWildcard, "index.ts", "./*", "./*.ts"),
    exposed(extensionWildcard, "src/index.ts", "./*", "./*.ts"),
    exposed(conditions, "src/icons/arrow.tsx", "./*", "./src/*.tsx"),
    exposed(nullCondition, "src/index.ts", "./*", "./src/*.ts"),
    exposed(unresolvedNestedDefault, "src/foo.ts", "./*", "./src/*.ts"),
    exposed(invalidFirst, "src/index.ts", "./*", "./src/*.ts"),
    exposed(conditionalFirst, "src/index.ts", "./*", "./src/*.ts"),
    exposed(nullDefaultFirst, "src/index.ts", "./*", "./src/*.ts"),
    exposed(blockedNamespace, "src/index.ts", "./*", "./src/*.ts"),
    exposed(blockedExtension, "src/cache.ts", "./*", "./src/*"),
    exposed(blockedExact, "src/index.ts", "./*", "./src/*.ts"),
    exposed(scopedNamespace, "src/index.ts", "./*", "./src/*.ts"),
    exposed(renamedSubpath, "src/index.ts", "./utils/*", "./src/*.ts"),
    exposed(libraryRoot, "lib/cache.ts", "./*", "./lib/*.ts"),
    exposed(sourceRoot, "source/cache.js", "./*", "./source/*.js"),
    exposed(workspace, "packages/ui/src/button.ts", "./*", "./src/*.ts"),
    exposed(shielded, "src/index.ts", "./*", "./*"),
    exposed(broken, "src/index.ts", "./*", "./*"),
  ],
});

test("no-wildcard-source-exports rereads package.json after it changes", (t) => {
  const directory = temporaryProject(t);
  const testCase = { code, cwd: directory, filename: join(directory, "src/index.ts") };
  write(directory, "package.json", JSON.stringify({ exports: { ".": "./src/index.ts" } }));

  lintNow("no-wildcard-source-exports", noWildcardSourceExports, {
    valid: [testCase],
    invalid: [],
  });
  write(directory, "package.json", JSON.stringify({ exports: { "./*": "./src/*.ts" } }));
  lintNow("no-wildcard-source-exports", noWildcardSourceExports, {
    valid: [],
    invalid: [
      {
        ...testCase,
        errors: [{ messageId: "exposed", data: { subpath: "./*", target: "./src/*.ts" } }],
      },
    ],
  });
});

test("the oxlint CLI reports exposed files through the plugin", (t) => {
  const directory = temporaryProject(t);
  write(
    directory,
    "plugin.mjs",
    `import { noWildcardSourceExports } from ${JSON.stringify(new URL("./no-wildcard-source-exports.ts", import.meta.url).href)};\nexport default { meta: { name: "local" }, rules: { "no-wildcard-source-exports": noWildcardSourceExports } };\n`,
  );
  write(
    directory,
    ".oxlintrc.json",
    JSON.stringify({
      categories: { correctness: "off" },
      plugins: [],
      jsPlugins: [{ name: "local", specifier: "./plugin.mjs" }],
      rules: { "local/no-wildcard-source-exports": "error" },
    }),
  );
  write(directory, "package.json", JSON.stringify({ exports: { "./*": "./src/*.ts" } }));
  write(directory, "src/index.ts", code);
  write(directory, "scripts/build.ts", code);

  const { output } = lint(directory, "-c", ".oxlintrc.json", "src", "scripts");

  assert.match(output, /"filename":\s*"src\/index\.ts"/);
  assert.doesNotMatch(output, /scripts\/build\.ts/);
});
