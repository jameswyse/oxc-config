import { defineRule } from "@oxlint/plugins";

import { isGlobal, staticPropertyName, unwrapExpression } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const secretName =
  /(?:SECRET|TOKEN|PASSWORD|PASSPHRASE|PRIVATE|CREDENTIAL|SALT|SIGNING|API_?KEY|ACCESS_?KEY|_KEY$|^KEY$)/iu;

function isEnvironment(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const environment = unwrapExpression(node);

  if (environment.type !== "MemberExpression" || staticPropertyName(environment) !== "env") {
    return false;
  }

  return (
    isGlobal(sourceCode, unwrapExpression(environment.object), "process") ||
    (environment.object.type === "MetaProperty" && environment.object.property.name === "meta")
  );
}

function secretRead(sourceCode: SourceCode, node: ESTree.Node): string | null {
  const read = unwrapExpression(node);
  const name = read.type === "MemberExpression" ? staticPropertyName(read) : null;

  return read.type === "MemberExpression" &&
    name !== null &&
    secretName.test(name) &&
    isEnvironment(sourceCode, read.object)
    ? name
    : null;
}

function isLiteralFallback(node: ESTree.Node): boolean {
  const fallback = unwrapExpression(node);

  return (
    (fallback.type === "Literal" && typeof fallback.value === "string") ||
    (fallback.type === "TemplateLiteral" && fallback.expressions.length === 0)
  );
}

export const noSecretFallback = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow literal fallbacks for secret environment variables." },
    schema: [],
    messages: {
      fallback:
        "`{{name}}` falls back to a value written in the source, so a missing secret silently becomes a known one. Fail at startup when it is missing.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      LogicalExpression(node) {
        const name = node.operator === "&&" ? null : secretRead(sourceCode, node.left);

        if (name !== null && isLiteralFallback(node.right)) {
          context.report({ node, messageId: "fallback", data: { name } });
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.type !== "ObjectPattern" ||
          node.init === null ||
          !isEnvironment(sourceCode, node.init)
        ) {
          return;
        }

        for (const property of node.id.properties) {
          const name = property.type === "Property" ? staticPropertyName(property) : null;

          if (
            property.type === "Property" &&
            name !== null &&
            secretName.test(name) &&
            property.value.type === "AssignmentPattern" &&
            isLiteralFallback(property.value.right)
          ) {
            context.report({ node: property, messageId: "fallback", data: { name } });
          }
        }
      },
    };
  },
});
