import { readdirSync } from "node:fs";
import { basename, dirname } from "node:path";

import { defineRule } from "@oxlint/plugins";

import { projectPath } from "../shared/index.ts";

import type { Dirent } from "node:fs";

import type { Context } from "@oxlint/plugins";

const companionMarkers = new Set(["test", "spec", "bench"]);

const integrationSegments = new Set(["integration", "e2e"]);

const integrationDirectories = new Set(["tests", "test", "__tests__", "e2e", "__e2e__"]);

const directoryEntries = new Map<string, Dirent[]>();

function entries(directory: string): Dirent[] {
  const cached = directoryEntries.get(directory);

  if (cached !== undefined) {
    return cached;
  }

  const read = readdirSync(directory, { withFileTypes: true });

  directoryEntries.set(directory, read);

  return read;
}

function segmentsOf(name: string): string[] {
  return name.split(".").slice(0, -1);
}

function isCompanion(segments: readonly string[]): boolean {
  const marker = segments.at(-1);

  return segments.length > 1 && marker !== undefined && companionMarkers.has(marker);
}

function ownerStems(directory: string): Set<string> {
  const stems = new Set([basename(directory)]);

  for (const entry of entries(directory)) {
    const segments = segmentsOf(entry.name);

    if (entry.isDirectory()) {
      stems.add(entry.name);
    } else if (entry.isFile() && segments.length > 0 && !isCompanion(segments)) {
      stems.add(segments.join("."));
    }
  }

  return stems;
}

function prefixes(segments: readonly string[]): string[] {
  return segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join("."));
}

function isIntegrationTest(context: Context, segments: readonly string[]): boolean {
  return (
    segments.some((segment) => integrationSegments.has(segment)) ||
    projectPath(context.cwd, dirname(context.filename))
      .split("/")
      .some((directory) => integrationDirectories.has(directory))
  );
}

export const companionHasOwner = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Start a test file's name with the basename of the sibling module it covers.",
    },
    schema: [],
    messages: {
      owner:
        "'{{name}}' has no sibling module named '{{owner}}'. Start the name with its owner's basename, such as `{{owner}}.case.test`, and rename it after moving or deleting the owner. Name a cross-module test `<behaviour>.integration.test` at the nearest common owner.",
    },
  },
  create(context) {
    const name = basename(context.filename);
    const segments = segmentsOf(name);

    if (!isCompanion(segments) || isIntegrationTest(context, segments)) {
      return {};
    }

    const stems = ownerStems(dirname(context.filename));

    if (prefixes(segments).some((stem) => stems.has(stem))) {
      return {};
    }

    return {
      Program(node) {
        context.report({ node, messageId: "owner", data: { name, owner: segments[0] } });
      },
    };
  },
});
