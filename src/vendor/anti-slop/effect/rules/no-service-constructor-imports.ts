// Adapted from dmmulroy/anti-slop
import { defineRule } from "@oxlint/plugins";

import type { ESTree, Reference } from "@oxlint/plugins";

const SERVICE_CONSTRUCTOR_NAME = /^make[A-Z]/u;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

function isProjectLocalImport(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../");
}

function getImportedName(specifier: ESTree.ImportSpecifier): string {
  if (specifier.imported.type === "Identifier") {
    return specifier.imported.name;
  }

  return specifier.imported.value;
}

function isCallOrTypeQuery(reference: Reference): boolean {
  const parent = reference.identifier.parent;

  return (
    parent.type === "TSTypeQuery" ||
    (parent.type === "CallExpression" && parent.callee === reference.identifier)
  );
}

export const noServiceConstructorImports = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow project-local make<CapabilityName> service values imported outside test and spec files.",
    },
    messages: {
      serviceConstructorImport:
        'Do not import Effect service constructor "{{name}}" into runtime code. Import the owning Layer, yield the contextual service, and allow its requirements to propagate to the composition root.',
    },
  },
  create(context) {
    const isTestFile = TEST_FILE.test(context.filename.replaceAll("\\", "/"));

    return {
      ImportDeclaration(node) {
        if (isTestFile || !isProjectLocalImport(node.source.value)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") {
            continue;
          }

          const importedName = getImportedName(specifier);

          if (
            !SERVICE_CONSTRUCTOR_NAME.test(importedName) ||
            context.sourceCode
              .getDeclaredVariables(specifier)
              .every((variable) => variable.references.every(isCallOrTypeQuery))
          ) {
            continue;
          }

          context.report({
            node: specifier,
            messageId: "serviceConstructorImport",
            data: { name: importedName },
          });
        }
      },
    };
  },
});
