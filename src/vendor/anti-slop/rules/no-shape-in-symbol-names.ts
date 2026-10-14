// Adapted from dmmulroy/anti-slop
import { defineRule } from "@oxlint/plugins";

import { variableFor } from "../../../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const FORBIDDEN_SYMBOL_NAME = "shape";

function containsForbiddenSymbolName(name: string): boolean {
  return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME);
}

function isBorrowedMemberName(node: ESTree.Node): boolean {
  const parent = node.parent;

  if (parent === null || parent.type !== "MemberExpression") {
    return false;
  }

  return parent.property === node && !parent.computed;
}

function importedName(specifier: ESTree.ImportSpecifier): string {
  return specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : specifier.imported.value;
}

function isPackageImport(specifier: ESTree.Node): specifier is ESTree.ImportSpecifier {
  return (
    specifier.type === "ImportSpecifier" &&
    specifier.parent.type === "ImportDeclaration" &&
    !/^(?:\.{1,2}\/|@\/|~\/|#)/u.test(specifier.parent.source.value)
  );
}

function isBorrowedImportName(
  sourceCode: SourceCode,
  node: ESTree.Node & { readonly name: string },
): boolean {
  const parent = node.parent;

  if (parent?.type === "ImportSpecifier" && parent.imported === node) {
    return isPackageImport(parent);
  }

  const variable = variableFor(sourceCode, node);
  const definition = variable?.defs[0];
  const specifier = definition?.type === "ImportBinding" ? definition.node : null;

  return (
    specifier !== null &&
    isPackageImport(specifier) &&
    importedName(specifier) === node.name &&
    (definition?.name === node ||
      (variable?.references.some((reference) => reference.identifier === node) ?? false))
  );
}

export const noForbiddenTermInSymbolNames = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow the case-insensitive substring "shape" in JavaScript, TypeScript, private, and JSX symbol names.',
    },
    messages: {
      forbiddenSymbolName:
        'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.',
    },
  },
  createOnce(context) {
    const reportForbiddenSymbolName = (node: ESTree.Node & { readonly name: string }): void => {
      if (
        !containsForbiddenSymbolName(node.name) ||
        isBorrowedMemberName(node) ||
        isBorrowedImportName(context.sourceCode, node)
      ) {
        return;
      }

      context.report({ node, messageId: "forbiddenSymbolName", data: { name: node.name } });
    };

    return {
      Identifier: reportForbiddenSymbolName,
      PrivateIdentifier: reportForbiddenSymbolName,
      JSXIdentifier: reportForbiddenSymbolName,
    };
  },
});
