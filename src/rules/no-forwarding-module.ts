import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, matchesGlob, resolve } from "node:path";

import { defineRule } from "@oxlint/plugins";

import { projectPath } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

const routeFiles = new Set([
  "page",
  "layout",
  "template",
  "route",
  "loading",
  "error",
  "global-error",
  "not-found",
  "forbidden",
  "unauthorized",
  "default",
  "opengraph-image",
  "twitter-image",
  "icon",
  "apple-icon",
  "sitemap",
  "robots",
  "manifest",
]);

const rootFiles = new Set(["middleware", "proxy", "instrumentation", "instrumentation-client"]);

const manifests = new Map<string, string | null>();

const entrypoints = new Map<string, string[]>();

function manifestDirectory(directory: string): string | null {
  const cached = manifests.get(directory);

  if (cached !== undefined) {
    return cached;
  }

  const parent = dirname(directory);

  const manifest = existsSync(join(directory, "package.json"))
    ? directory
    : parent === directory
      ? null
      : manifestDirectory(parent);

  manifests.set(directory, manifest);

  return manifest;
}

function targets(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap(targets);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).flatMap(targets);
  }

  return [];
}

function manifestFields(directory: string): ReadonlyMap<string, unknown> {
  const manifest: unknown = JSON.parse(readFileSync(join(directory, "package.json"), "utf8"));

  return new Map<string, unknown>(
    typeof manifest === "object" && manifest !== null ? Object.entries(manifest) : [],
  );
}

function packageEntrypoints(directory: string): string[] {
  const cached = entrypoints.get(directory);

  if (cached !== undefined) {
    return cached;
  }

  const manifest = manifestFields(directory);

  const fields = [
    manifest.get("main") ?? "index.js",
    manifest.get("module"),
    manifest.get("source"),
    manifest.get("browser"),
    manifest.get("types"),
    manifest.get("typings"),
  ];

  const resolved = [...targets(fields), ...targets(manifest.get("exports"))].map((target) =>
    resolve(directory, target),
  );

  entrypoints.set(directory, resolved);

  return resolved;
}

function withoutExtension(path: string): string {
  return path.replace(/(?:\.d)?\.[cm]?[jt]sx?$/, "");
}

function isPackageEntrypoint(directory: string, filename: string): boolean {
  const file = withoutExtension(filename);

  return packageEntrypoints(directory).some((target) =>
    target.includes("*")
      ? matchesGlob(file, withoutExtension(target))
      : withoutExtension(target) === file,
  );
}

function isFrameworkFile(directory: string, filename: string): boolean {
  const path = projectPath(directory, filename).split("/").slice(0, -1);
  const name = withoutExtension(basename(filename));
  const directories = path[0] === "src" ? path.slice(1) : path;

  return (
    (directories[0] === "app" && routeFiles.has(name)) ||
    directories[0] === "pages" ||
    (directories.length === 0 && rootFiles.has(name))
  );
}

function exportedLocalName(specifier: ESTree.ExportSpecifier): string {
  return specifier.local.type === "Literal" ? specifier.local.value : specifier.local.name;
}

function isForwarding(body: ESTree.Program["body"]): boolean {
  const imported = new Set<string>();
  const exported = new Set<string>();
  let forwards = false;

  for (const statement of body) {
    if (statement.type === "ExportAllDeclaration") {
      forwards = true;
      continue;
    }

    if (statement.type === "ExportNamedDeclaration" && statement.declaration === null) {
      if (statement.source !== null) {
        forwards ||= statement.specifiers.length > 0;
      } else {
        for (const specifier of statement.specifiers) {
          exported.add(exportedLocalName(specifier));
        }
      }

      continue;
    }

    if (
      statement.type === "ExportDefaultDeclaration" &&
      statement.declaration.type === "Identifier"
    ) {
      exported.add(statement.declaration.name);
      continue;
    }

    if (statement.type === "ImportDeclaration" && statement.specifiers.length > 0) {
      forwards = true;

      for (const specifier of statement.specifiers) {
        imported.add(specifier.local.name);
      }

      continue;
    }

    return false;
  }

  return (
    forwards && imported.size === exported.size && [...imported].every((name) => exported.has(name))
  );
}

export const noForwardingModule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Import from the authoritative module instead of a file that only re-exports.",
    },
    schema: [],
    messages: {
      forwarding:
        "This module only re-exports other modules. Import from the authoritative module directly, or make this file a package entrypoint if it defines a supported public interface.",
    },
  },
  create(context) {
    return {
      Program(node) {
        if (!isForwarding(node.body)) {
          return;
        }

        const directory = manifestDirectory(dirname(context.filename));

        if (
          directory === null ||
          (!isFrameworkFile(directory, context.filename) &&
            !isPackageEntrypoint(directory, context.filename))
        ) {
          context.report({ node, messageId: "forwarding" });
        }
      },
    };
  },
});
