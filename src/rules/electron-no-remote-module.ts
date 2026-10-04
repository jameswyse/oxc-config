import { defineRule } from "@oxlint/plugins";

import { isGlobal, propertyName, variableFor } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

function moduleName(node: ESTree.Node | null | undefined): string | null {
  return node?.type === "Literal" && typeof node.value === "string" ? node.value : null;
}

function isRemotePackage(name: string | null): boolean {
  return name === "@electron/remote" || (name?.startsWith("@electron/remote/") ?? false);
}

function isElectron(name: string | null): boolean {
  return name === "electron" || (name?.startsWith("electron/") ?? false);
}

function requiredModule(
  sourceCode: SourceCode,
  node: ESTree.Node | null | undefined,
): string | null {
  return node?.type === "CallExpression" && isGlobal(sourceCode, node.callee, "require")
    ? moduleName(node.arguments[0])
    : null;
}

function isElectronModule(sourceCode: SourceCode, node: ESTree.Node | null | undefined): boolean {
  if (isElectron(requiredModule(sourceCode, node))) {
    return true;
  }

  if (node?.type !== "Identifier") {
    return false;
  }

  const [definition, ...otherDefinitions] = variableFor(sourceCode, node)?.defs ?? [];

  if (definition === undefined || otherDefinitions.length > 0) {
    return false;
  }

  const { node: definitionNode, parent } = definition;

  if (definition.type === "ImportBinding") {
    return (
      definitionNode.type !== "ImportSpecifier" &&
      parent?.type === "ImportDeclaration" &&
      isElectron(parent.source.value)
    );
  }

  return (
    definition.type === "Variable" &&
    parent?.type === "VariableDeclaration" &&
    parent.kind === "const" &&
    definitionNode.type === "VariableDeclarator" &&
    definitionNode.id.type === "Identifier" &&
    isElectron(requiredModule(sourceCode, definitionNode.init))
  );
}

function specifierName(node: ESTree.ModuleExportName): string {
  return node.type === "Identifier" ? node.name : node.value;
}

export const electronNoRemoteModule = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow Electron's remote module and @electron/remote." },
    schema: [],
    messages: {
      remote: "Do not use Electron remote APIs. Expose a narrow, validated IPC operation instead.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function checkSource(node: ESTree.Node, source: ESTree.Node | null | undefined): boolean {
      if (isRemotePackage(moduleName(source))) {
        context.report({ node, messageId: "remote" });

        return true;
      }

      return false;
    }

    return {
      ImportDeclaration(node) {
        if (checkSource(node, node.source) || !isElectron(node.source.value)) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            specifierName(specifier.imported) === "remote"
          ) {
            context.report({ node: specifier, messageId: "remote" });
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (checkSource(node, node.source) || !isElectron(moduleName(node.source))) {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifierName(specifier.local) === "remote") {
            context.report({ node: specifier, messageId: "remote" });
          }
        }
      },
      ExportAllDeclaration(node) {
        checkSource(node, node.source);
      },
      ImportExpression(node) {
        checkSource(node, node.source);
      },
      CallExpression(node) {
        if (isGlobal(sourceCode, node.callee, "require")) {
          checkSource(node, node.arguments[0]);
        }
      },
      MemberExpression(node) {
        if (propertyName(node) === "remote" && isElectronModule(sourceCode, node.object)) {
          context.report({ node, messageId: "remote" });
        }
      },
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || !isElectronModule(sourceCode, node.init)) {
          return;
        }

        for (const property of node.id.properties) {
          if (property.type === "Property" && propertyName(property) === "remote") {
            context.report({ node: property, messageId: "remote" });
          }
        }
      },
    };
  },
});
