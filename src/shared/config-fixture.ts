import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { TestContext } from "node:test";

const require = createRequire(import.meta.url);

export const lintBin = join(dirname(require.resolve("oxlint/package.json")), "bin/oxlint");

export const formatBin = join(dirname(require.resolve("oxfmt/package.json")), "bin/oxfmt");

export function write(root: string, path: string, contents: string): void {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

export function temporaryProject(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), "oxc-config-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  return root;
}

export function run(root: string, bin: string, args: string[]) {
  const result = spawnSync(process.execPath, [bin, ...args], { cwd: root, encoding: "utf8" });
  assert.ifError(result.error);

  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

export function lint(root: string, ...args: string[]) {
  return run(root, lintBin, ["--format", "json", ...args]);
}
