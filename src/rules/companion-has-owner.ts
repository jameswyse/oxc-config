import { existsSync, readdirSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { basename, dirname, extname, join, resolve } from "node:path";

import { defineRule } from "@oxlint/plugins";

import { isGlobal, projectPath, staticString } from "../shared/index.ts";
import { nearestPackageDirectory, readPackageManifest } from "../shared/package-manifest.ts";

import type { ESTree } from "@oxlint/plugins";

const companionMarkers = new Set(["test", "spec", "bench"]);

const integrationSegments = new Set(["integration", "e2e"]);

const testDirectories = new Set(["tests", "test", "__tests__"]);

const endToEndDirectories = new Set(["e2e", "__e2e__"]);

const integrationDirectories = new Set([...testDirectories, ...endToEndDirectories]);

const moduleExtensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

const typeScriptCounterparts = new Map([
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
]);

type ModuleImport = {
  readonly source: ESTree.Node;
  readonly specifier: string;
};

type ResolvedImport = {
  readonly source: ESTree.Node;
  readonly file: string;
};

function isFile(path: string) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;
}

function ancestors(directory: string): string[] {
  const parent = dirname(directory);

  return parent === directory ? [directory] : [directory, ...ancestors(parent)];
}

function segmentsOf(name: string) {
  return name.split(".").slice(0, -1);
}

function isCompanion(segments: readonly string[]) {
  const marker = segments.at(-1);

  return segments.length > 1 && marker !== undefined && companionMarkers.has(marker);
}

function ownerStems(directory: string) {
  const stems = new Set([basename(directory)]);

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const segments = segmentsOf(entry.name);

    if (entry.isDirectory()) {
      stems.add(entry.name);
    } else if (entry.isFile() && segments.length > 0 && !isCompanion(segments)) {
      stems.add(segments.join("."));
    }
  }

  return stems;
}

function hasOwner(directory: string, segments: readonly string[]) {
  const stems = ownerStems(directory);

  return segments
    .slice(0, -1)
    .some((_, index) => stems.has(segments.slice(0, index + 1).join(".")));
}

const aliasPrefixes = ["#", "@/", "~/", "$", "src/"];

const urlScheme = /^[a-z][a-z\d+.-]*:/iu;

function isRelative(specifier: string) {
  return (
    specifier === "." ||
    specifier === ".." ||
    specifier.startsWith("./") ||
    specifier.startsWith("../")
  );
}

function isDirectorySpecifier(specifier: string) {
  return specifier.endsWith("/") || [".", ".."].includes(basename(specifier));
}

function resolveModule(directory: string, specifier: string) {
  const target = resolve(directory, specifier);
  const indexes = moduleExtensions.map((candidate) => join(target, `index${candidate}`));

  if (isDirectorySpecifier(specifier)) {
    return indexes.find(isFile);
  }

  const extension = extname(target);
  const withoutExtension = target.slice(0, target.length - extension.length);

  return [
    target,
    ...moduleExtensions.map((candidate) => target + candidate),
    ...(typeScriptCounterparts.get(extension) ?? []).map(
      (candidate) => withoutExtension + candidate,
    ),
    ...indexes,
  ].find(isFile);
}

function ownPackageName(directory: string) {
  const packageDirectory = nearestPackageDirectory(directory);

  const name =
    packageDirectory === undefined ? undefined : readPackageManifest(packageDirectory)?.get("name");

  return typeof name === "string" ? name : null;
}

function packageName(specifier: string) {
  const segments = specifier.split("/");

  return segments.slice(0, specifier.startsWith("@") ? 2 : 1).join("/");
}

function isInstalled(directory: string, name: string) {
  return ancestors(directory).some((ancestor) => existsSync(join(ancestor, "node_modules", name)));
}

function resolvesThroughAlias(specifier: string, directory: string, ownPackage: string | null) {
  if (aliasPrefixes.some((prefix) => specifier.startsWith(prefix))) {
    return true;
  }

  if (specifier.startsWith("/") || urlScheme.test(specifier)) {
    return false;
  }

  if (ownPackage !== null && (specifier === ownPackage || specifier.startsWith(`${ownPackage}/`))) {
    return true;
  }

  const name = packageName(specifier);

  return !builtinModules.includes(name) && !isInstalled(directory, name);
}

function testHome(cwd: string, directory: string) {
  const directories = projectPath(cwd, directory).split("/");
  const testDirectory = directories.findLastIndex((name) => testDirectories.has(name));

  return testDirectory === -1 ? directory : resolve(cwd, ...directories.slice(0, testDirectory));
}

function isTypeOnlyImport(node: ESTree.ImportDeclaration) {
  return (
    node.importKind === "type" ||
    (node.specifiers.length > 0 &&
      node.specifiers.every(
        (specifier) => specifier.type === "ImportSpecifier" && specifier.importKind === "type",
      ))
  );
}

function isTypeOnlyExport(node: ESTree.ExportNamedDeclaration) {
  return (
    node.exportKind === "type" ||
    (node.specifiers.length > 0 &&
      node.specifiers.every((specifier) => specifier.exportKind === "type"))
  );
}

export const companionHasOwner = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Keep a test file beside the module it covers, named after that module's basename.",
    },
    schema: [],
    messages: {
      owner:
        "'{{name}}' has no sibling module named '{{owner}}'. Start the name with its owner's basename, such as `{{owner}}.case.test`, and rename it after moving or deleting the owner. Name a cross-module test `<behaviour>.integration.test` at the nearest common owner.",
      detached:
        "'{{name}}' imports no module from its own directory, starting instead with '{{directory}}'. Move it beside the module it tests, or into that module's local test directory, along with its fixtures and snapshots.",
    },
  },
  create(context) {
    const name = basename(context.filename);
    const segments = segmentsOf(name);

    if (!isCompanion(segments) || segments.some((segment) => integrationSegments.has(segment))) {
      return {};
    }

    const directory = dirname(context.filename);
    const directories = projectPath(context.cwd, directory).split("/");

    const missingOwner =
      !directories.some((entry) => integrationDirectories.has(entry)) &&
      !hasOwner(directory, segments);

    const checksPlacement = !directories.some((entry) => endToEndDirectories.has(entry));

    const moduleImports: ModuleImport[] = [];

    function collect(source: ESTree.Node | null | undefined) {
      const specifier = staticString(source);

      if (source && specifier !== null && !specifier.includes("\0")) {
        moduleImports.push({ source, specifier });
      }
    }

    function resolvedImports() {
      const resolved: ResolvedImport[] = [];

      for (const { source, specifier } of moduleImports) {
        const file = isRelative(specifier) ? resolveModule(directory, specifier) : undefined;

        if (file !== undefined) {
          resolved.push({ source, file });
        }
      }

      return resolved;
    }

    function importsThroughAlias() {
      const ownPackage = ownPackageName(directory);

      return moduleImports.some(
        ({ specifier }) =>
          !isRelative(specifier) && resolvesThroughAlias(specifier, directory, ownPackage),
      );
    }

    return {
      Program(node) {
        if (missingOwner) {
          context.report({ node, messageId: "owner", data: { name, owner: segments[0] } });
        }
      },
      ImportDeclaration(node) {
        if (!isTypeOnlyImport(node)) {
          collect(node.source);
        }
      },
      ExportNamedDeclaration(node) {
        if (!isTypeOnlyExport(node)) {
          collect(node.source);
        }
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== "type") {
          collect(node.source);
        }
      },
      ImportExpression(node) {
        collect(node.source);
      },
      CallExpression(node) {
        if (node.arguments.length === 1 && isGlobal(context.sourceCode, node.callee, "require")) {
          collect(node.arguments[0]);
        }
      },
      "Program:exit"() {
        if (!checksPlacement) {
          return;
        }

        const resolved = resolvedImports();
        const [first] = resolved;
        const home = testHome(context.cwd, directory);

        if (
          first === undefined ||
          resolved.some(({ file }) => dirname(file) === home) ||
          importsThroughAlias()
        ) {
          return;
        }

        context.report({
          node: first.source,
          messageId: "detached",
          data: { name, directory: projectPath(context.cwd, dirname(first.file)) || "." },
        });
      },
    };
  },
});
