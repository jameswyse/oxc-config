import { defineRule } from "@oxlint/plugins";

import {
  importedBinding,
  isGlobalValue,
  isNodeGlobalValue,
  moduleExportName,
  staticPropertyName,
  staticString,
  unwrapExpression,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const processModules = new Set(["node:process", "process"]);

const environmentExports = new Set(["env", "default"]);

function isImportMeta(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);

  return (
    value.type === "MetaProperty" && value.meta.name === "import" && value.property.name === "meta"
  );
}

function isProcessModule(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const binding = importedBinding(sourceCode, node);

  return (
    binding !== null &&
    processModules.has(binding.source) &&
    (binding.name === "*" || binding.name === "default")
  );
}

function isEnvironmentSource(
  sourceCode: SourceCode,
  node: ESTree.Node | null | undefined,
): boolean {
  if (!node) {
    return false;
  }

  return (
    isNodeGlobalValue(sourceCode, node, "process") ||
    isImportMeta(node) ||
    isProcessModule(sourceCode, node)
  );
}

function isReflectGet(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(node.callee);
  const [target, key] = node.arguments;

  return (
    callee.type === "MemberExpression" &&
    staticPropertyName(callee) === "get" &&
    isGlobalValue(sourceCode, callee.object, "Reflect") &&
    target?.type !== "SpreadElement" &&
    isEnvironmentSource(sourceCode, target) &&
    staticString(key) === "env"
  );
}

export const noEnvAccess = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Read environment variables only in the configuration owner." },
    schema: [],
    messages: {
      env: "Read environment variables in the configuration owner and pass parsed values in. If this file parses configuration, add it to the `env` owners.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      MemberExpression(node) {
        if (staticPropertyName(node) === "env" && isEnvironmentSource(sourceCode, node.object)) {
          context.report({ node, messageId: "env" });
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type === "ObjectPattern" &&
          isEnvironmentSource(sourceCode, node.init) &&
          node.id.properties.some(
            (property) => property.type === "Property" && staticPropertyName(property) === "env",
          )
        ) {
          context.report({ node, messageId: "env" });
        }
      },
      CallExpression(node) {
        if (isReflectGet(sourceCode, node)) {
          context.report({ node, messageId: "env" });
        }
      },
      ImportDeclaration(node) {
        if (!processModules.has(node.source.value) || node.importKind === "type") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.importKind !== "type" &&
            moduleExportName(specifier.imported) === "env"
          ) {
            context.report({ node: specifier, messageId: "env" });
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (!node.source || !processModules.has(node.source.value) || node.exportKind === "type") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.exportKind !== "type" &&
            environmentExports.has(moduleExportName(specifier.local))
          ) {
            context.report({ node: specifier, messageId: "env" });
          }
        }
      },
      ExportAllDeclaration(node) {
        if (processModules.has(node.source.value) && node.exportKind !== "type") {
          context.report({ node, messageId: "env" });
        }
      },
    };
  },
});
