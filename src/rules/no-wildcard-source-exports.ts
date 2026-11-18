import { dirname } from "node:path";

import { defineRule } from "@oxlint/plugins";

import { projectPath } from "../shared/index.ts";
import { nearestPackageDirectory, readPackageManifest } from "../shared/package-manifest.ts";

const unrestrictedTarget = /^\.\/(?:(?<directory>[^/*]+)\/)?\*(?:\.\w+)*$/;

const buildOutputDirectories = new Set(["dist", "build", "out", "esm", "cjs", ".output"]);

const invalidTargetSegments = new Set([".", "..", "node_modules"]);

function isValidTarget(target: string) {
  return (
    target.startsWith("./") &&
    target
      .slice(2)
      .split("/")
      .every((segment) => !invalidTargetSegments.has(segment.toLowerCase()))
  );
}

type Reach = { targets: string[]; alwaysResolves: boolean };

const reach: (value: unknown) => Reach = (value) => {
  if (typeof value === "string") {
    const valid = isValidTarget(value);

    return { targets: valid ? [value] : [], alwaysResolves: valid };
  }

  if (typeof value !== "object" || value === null) {
    return { targets: [], alwaysResolves: false };
  }

  const isFallbackArray = Array.isArray(value);
  const targets: string[] = [];

  for (const [key, branch] of Object.entries(value)) {
    const reached = reach(branch);
    targets.push(...reached.targets);

    const settlesResolution = isFallbackArray
      ? reached.alwaysResolves
      : key === "default" &&
        (reached.alwaysResolves || typeof branch !== "object" || branch === null);

    if (settlesResolution) {
      return { targets, alwaysResolves: reached.alwaysResolves };
    }
  }

  return { targets, alwaysResolves: false };
};

function subpathEntries(exports: unknown) {
  if (typeof exports !== "object" || exports === null || Array.isArray(exports)) {
    return [];
  }

  const entries: [string, unknown][] = Object.entries(exports);

  return entries.every(([key]) => key.startsWith(".")) ? entries : [];
}

function wildcardParts(pattern: string) {
  const star = pattern.indexOf("*");

  return star === -1 || star !== pattern.lastIndexOf("*")
    ? undefined
    : { prefix: pattern.slice(0, star), suffix: pattern.slice(star + 1) };
}

function selectedKey(keys: readonly string[], subpath: string) {
  if (keys.includes(subpath)) {
    return subpath;
  }

  return keys
    .filter((key) => {
      const parts = wildcardParts(key);

      return (
        parts !== undefined &&
        subpath.length >= key.length &&
        subpath.startsWith(parts.prefix) &&
        subpath.endsWith(parts.suffix)
      );
    })
    .toSorted((left, right) => right.indexOf("*") - left.indexOf("*") || right.length - left.length)
    .at(0);
}

function unrestrictedMatch(target: string, path: string) {
  const unrestricted = unrestrictedTarget.exec(target);
  const parts = wildcardParts(target.slice(2));

  if (
    unrestricted === null ||
    buildOutputDirectories.has(unrestricted.groups?.["directory"] ?? "") ||
    parts === undefined ||
    path.length <= parts.prefix.length + parts.suffix.length ||
    !path.startsWith(parts.prefix) ||
    !path.endsWith(parts.suffix)
  ) {
    return undefined;
  }

  return path.slice(parts.prefix.length, path.length - parts.suffix.length);
}

function exposure(exports: unknown, path: string) {
  const entries = subpathEntries(exports);
  const keys = entries.map(([key]) => key);

  return entries
    .filter(([subpath]) => subpath.includes("*"))
    .flatMap(([subpath, value]) => reach(value).targets.map((target) => ({ subpath, target })))
    .find(({ subpath, target }) => {
      const key = wildcardParts(subpath);
      const match = unrestrictedMatch(target, path);

      return (
        key !== undefined &&
        match !== undefined &&
        selectedKey(keys, `${key.prefix}${match}${key.suffix}`) === subpath
      );
    });
}

export const noWildcardSourceExports = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Declare explicit package entrypoints instead of an `exports` pattern that makes every source file public.",
    },
    schema: [],
    messages: {
      exposed:
        'The package export `"{{subpath}}": "{{target}}"` makes this file and every other source file part of the package\'s public interface. Declare explicit entrypoints or named public namespaces such as `"./icons/*": "./src/icons/*.ts"` instead.',
    },
  },
  create(context) {
    const directory = nearestPackageDirectory(dirname(context.filename));

    if (directory === undefined) {
      return {};
    }

    const exposed = exposure(
      readPackageManifest(directory)?.get("exports"),
      projectPath(directory, context.filename),
    );

    if (exposed === undefined) {
      return {};
    }

    return {
      Program(node) {
        context.report({ node, messageId: "exposed", data: { ...exposed } });
      },
    };
  },
});
