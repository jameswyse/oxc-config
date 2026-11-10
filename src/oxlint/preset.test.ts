import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import { lint, temporaryProject, write } from "../shared/config-fixture.ts";
import { defineLintPreset, extendProfile, filesFor } from "./preset.ts";
import { core } from "./profiles/core.ts";
import { boundaries } from "./profiles/ownership.ts";
import { tests, vitest } from "./profiles/tests.ts";

import type { FileScope, Profile, SharedLintConfig } from "./preset.ts";

const mobile: Profile<FileScope> = (scope, files) => [
  {
    files: filesFor(files, scope.source),
    excludeFiles: scope.tests,
    rules: { "eslint/no-alert": "error" },
  },
];

const strictVitest = extendProfile(vitest, (scope, files) => [
  { files: filesFor(files, scope.tests), rules: { "eslint/no-console": "error" } },
]);

const createLintConfig = defineLintPreset({
  base: [core, tests],
  profiles: { mobile, vitest: strictVitest },
  rules: { "wyse/no-vacuous-test-assertions": "off" },
});

function project(t: TestContext, config: SharedLintConfig): string {
  const root = temporaryProject(t);
  write(root, "oxlint.config.ts", `export default ${JSON.stringify(config)};\n`);

  return root;
}

test("a preset applies only the base profiles it lists", (t) => {
  const root = project(t, createLintConfig({ typeAware: false }));
  write(
    root,
    "src/value.ts",
    "// A comment.\nexport const value: any = 1;\n\nvar legacy = value;\n",
  );
  const result = lint(root, "src/value.ts");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /no-var/);
  assert.doesNotMatch(result.output, /no-comments|no-explicit-any/);
});

test("a preset's own profile applies to the files its option names", (t) => {
  const root = project(t, createLintConfig({ typeAware: false, mobile: ["apps/mobile/**"] }));
  const source = 'export function warn(): void {\n  alert("warning");\n}\n';
  write(root, "apps/mobile/warn.ts", source);
  write(root, "apps/mobile/warn.test.ts", source);
  write(root, "apps/web/warn.ts", source);
  const mobileApp = lint(root, "apps/mobile/warn.ts");
  assert.equal(mobileApp.status, 1, mobileApp.output);
  assert.match(mobileApp.output, /no-alert/);
  const elsewhere = lint(root, "apps/mobile/warn.test.ts", "apps/web/warn.ts");
  assert.equal(elsewhere.status, 0, elsewhere.output);

  for (const mobileOption of [false as const, []]) {
    const disabled = project(t, createLintConfig({ typeAware: false, mobile: mobileOption }));
    write(disabled, "apps/mobile/warn.ts", source);
    assert.equal(lint(disabled, "apps/mobile/warn.ts").status, 0);
  }
});

test("an extended test runner keeps its files in the test scope", (t) => {
  const root = project(t, createLintConfig({ typeAware: false, vitest: ["checks/**/*.ts"] }));

  const source =
    'import { expect, test } from "vitest";\n\ntest("result", () => {\n  console.log("checking");\n  expect(value).toBe(expected);\n});\n';

  write(root, "checks/result.ts", source);
  write(root, "src/result.ts", source);
  assert.match(lint(root, "checks/result.ts").output, /no-console/);
  assert.doesNotMatch(lint(root, "src/result.ts").output, /no-console/);
});

test("a project re-enables a rule its preset turned off, in the files the profile scopes it to", (t) => {
  const vacuous =
    'import { expect, test } from "vitest";\n\ntest("result", () => {\n  expect(1).toBe(1);\n});\n';

  const preset = project(t, createLintConfig({ typeAware: false }));
  write(preset, "src/result.test.ts", vacuous);
  assert.doesNotMatch(lint(preset, "src/result.test.ts").output, /no-vacuous-test-assertions/);

  const root = project(
    t,
    createLintConfig({ typeAware: false, rules: { "wyse/no-vacuous-test-assertions": "warn" } }),
  );

  write(root, "src/result.test.ts", vacuous);
  write(root, "src/result.ts", vacuous);
  const unit = lint(root, "src/result.test.ts");
  assert.match(unit.output, /"code": "wyse\(no-vacuous-test-assertions\)","severity": "warning"/);
  assert.doesNotMatch(lint(root, "src/result.ts").output, /no-vacuous-test-assertions/);
});

test("a later profile's rule for every file wins over an earlier profile's scoped rule", (t) => {
  const createOrderedConfig = defineLintPreset({
    base: [
      core,
      (scope) => [{ files: scope.source, rules: { "eslint/no-alert": "error" } }],
      () => [{ rules: { "eslint/no-alert": "off" } }],
    ],
    profiles: {},
  });

  const root = project(t, createOrderedConfig({ typeAware: false }));
  write(root, "src/warn.ts", 'export function warn(): void {\n  alert("warning");\n}\n');
  const result = lint(root, "src/warn.ts");
  assert.equal(result.status, 0, result.output);
});

const exemptBoundaries = extendProfile(boundaries, () => [
  { files: ["src/legacy/**"], rules: { "wyse/import-boundaries": "off" } },
]);

test("a layer after a profile's import boundaries can exempt files from them", (t) => {
  const createBoundedConfig = defineLintPreset({
    base: [core],
    profiles: { boundaries: exemptBoundaries },
  });

  const root = temporaryProject(t);

  const config = createBoundedConfig({
    typeAware: false,
    root,
    boundaries: [{ files: ["src/**"], deny: ["node:*"], message: "Stay portable." }],
  });

  write(root, "oxlint.config.ts", `export default ${JSON.stringify(config)};\n`);
  const source = 'import { readFile } from "node:fs";\n\nexport { readFile };\n';
  write(root, "src/legacy/files.ts", source);
  write(root, "src/files.ts", source);
  assert.equal(lint(root, "src/legacy/files.ts").status, 0);
  const current = lint(root, "src/files.ts");
  assert.equal(current.status, 1, current.output);
  assert.match(current.output, /import-boundaries/);
});

test("a later profile's import boundaries apply to files an earlier layer exempted", (t) => {
  const root = temporaryProject(t);

  const createLayeredConfig = defineLintPreset({
    base: [
      core,
      () => [{ boundaries: [{ files: ["src/**"], deny: ["node:*"], message: "Stay portable." }] }],
      () => [{ files: ["src/legacy/**"], rules: { "wyse/import-boundaries": "off" } }],
      () => [{ boundaries: [{ files: ["src/**"], deny: ["electron"], message: "Use preload." }] }],
    ],
    profiles: {},
  });

  const config = createLayeredConfig({ typeAware: false, root });
  write(root, "oxlint.config.ts", `export default ${JSON.stringify(config)};\n`);
  write(
    root,
    "src/legacy/window.ts",
    'import { ipcRenderer } from "electron";\n\nexport { ipcRenderer };\n',
  );
  const result = lint(root, "src/legacy/window.ts");
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /Use preload/);
});
