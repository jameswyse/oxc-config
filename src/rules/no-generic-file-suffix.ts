import { basename } from "node:path";

import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const companionSegments = new Set(["test", "spec", "stories", "story", "bench", "e2e"]);

const genericSegment = /(?:^|[-_])(?:policy|contract)$/i;

const genericSuffix = /[a-z0-9](?:Policy|Contract)$/;

const standardTerms = [
  "contentsecuritypolicy",
  "permissionspolicy",
  "featurepolicy",
  "referrerpolicy",
  "privacypolicy",
  "crossoriginopenerpolicy",
  "crossoriginembedderpolicy",
  "crossoriginresourcepolicy",
];

function fileName(filename: string): string | null {
  const segments = basename(filename).split(".").slice(0, -1);

  if (segments.at(-1) === "d") {
    segments.pop();
  }

  const name = segments.at(-1);

  if (name === undefined) {
    return null;
  }

  return segments.length > 1 && companionSegments.has(name.toLowerCase()) ? null : name;
}

function isGeneric(name: string): boolean {
  const normalised = name.replaceAll(/[-_]/g, "").toLowerCase();

  return (
    (genericSegment.test(name) || genericSuffix.test(name)) &&
    !standardTerms.some((term) => normalised.endsWith(term))
  );
}

function declaredNames(declaration: ESTree.Declaration): string[] {
  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((declarator) =>
      declarator.id.type === "Identifier" ? [declarator.id.name] : [],
    );
  }

  return declaration.id?.type === "Identifier" ? [declaration.id.name] : [];
}

function exportedNames(program: ESTree.Program): string[] {
  return program.body.flatMap((statement) => {
    if (statement.type !== "ExportNamedDeclaration") {
      return [];
    }

    if (statement.declaration) {
      return declaredNames(statement.declaration);
    }

    return statement.specifiers.map(({ exported }) =>
      exported.type === "Identifier" ? exported.name : exported.value,
    );
  });
}

export const noGenericFileSuffix = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Name files after what they contain instead of `Contract` or `Policy`. Companions follow their owner's name.",
    },
    schema: [],
    messages: {
      suffix:
        "Rename '{{name}}' after what it contains. `Contract` and `Policy` hide whether the file holds types, constants, validation, or configuration; prefer a name such as `quoteEligibility`.",
    },
  },
  create(context) {
    const name = fileName(context.filename);

    if (!name || !isGeneric(name)) {
      return {};
    }

    return {
      Program(node) {
        const owned = name.toLowerCase();

        if (!exportedNames(node).some((exported) => exported.toLowerCase() === owned)) {
          context.report({ node, messageId: "suffix", data: { name: basename(context.filename) } });
        }
      },
    };
  },
});
