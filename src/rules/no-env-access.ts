import { defineRule } from "@oxlint/plugins";

import { isGlobal, propertyName } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

function isImportMeta(node: ESTree.Node | null): boolean {
  return (
    node?.type === "MetaProperty" && node.meta.name === "import" && node.property.name === "meta"
  );
}

function isEnvironmentSource(sourceCode: SourceCode, node: ESTree.Node | null): boolean {
  return isGlobal(sourceCode, node, "process") || isImportMeta(node);
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
        if (propertyName(node) === "env" && isEnvironmentSource(sourceCode, node.object)) {
          context.report({ node, messageId: "env" });
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type === "ObjectPattern" &&
          isEnvironmentSource(sourceCode, node.init) &&
          node.id.properties.some(
            (property) => property.type === "Property" && propertyName(property) === "env",
          )
        ) {
          context.report({ node, messageId: "env" });
        }
      },
    };
  },
});
