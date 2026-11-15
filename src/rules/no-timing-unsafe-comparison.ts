import { defineRule } from "@oxlint/plugins";

import { isGlobal, staticPropertyName, unwrapExpression } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const equalityOperators = new Set(["===", "!==", "==", "!="]);

const secretWords = new Set([
  "password",
  "secret",
  "token",
  "hash",
  "signature",
  "digest",
  "apikey",
]);

const word = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])/gu;

const pascalCase = /^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/u;

function isSecretName(name: string): boolean {
  if (pascalCase.test(name)) {
    return false;
  }

  const words = (name.match(word) ?? []).map((part) => part.toLowerCase());
  const last = words.at(-1);
  const beforeLast = words.at(-2);

  return (
    (last !== undefined && secretWords.has(last)) ||
    (last === "key" &&
      beforeLast !== undefined &&
      (beforeLast === "api" || secretWords.has(beforeLast)))
  );
}

function comparedName(node: ESTree.Node): string | null {
  const unwrapped = unwrapExpression(node);

  const value =
    unwrapped.type === "ChainExpression" ? unwrapExpression(unwrapped.expression) : unwrapped;

  if (value.type === "Identifier") {
    return value.name;
  }

  return value.type === "MemberExpression" ? staticPropertyName(value) : null;
}

function isNumber(node: ESTree.Node): boolean {
  return node.type === "Literal" && typeof node.value === "number";
}

function isNonSecretValue(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const value = unwrapExpression(node);

  if (value.type === "Literal") {
    return typeof value.value !== "string" || value.value === "";
  }

  if (value.type === "TemplateLiteral") {
    return value.expressions.length === 0 && value.quasis.every((quasi) => quasi.value.raw === "");
  }

  if (value.type === "UnaryExpression") {
    return (
      ["typeof", "void"].includes(value.operator) ||
      (["-", "+"].includes(value.operator) && isNumber(unwrapExpression(value.argument)))
    );
  }

  return isGlobal(sourceCode, value, "undefined");
}

export const noTimingUnsafeComparison = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow comparing secrets with equality operators." },
    schema: [],
    messages: {
      comparison:
        "Comparing `{{name}}` with `{{operator}}` stops at the first character that differs, so response times can reveal the secret. Compare equal-length buffers with `crypto.timingSafeEqual` instead.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      BinaryExpression(node) {
        if (
          !equalityOperators.has(node.operator) ||
          isNonSecretValue(sourceCode, node.left) ||
          isNonSecretValue(sourceCode, node.right)
        ) {
          return;
        }

        const name = [comparedName(node.left), comparedName(node.right)].find(
          (candidate): candidate is string => candidate !== null && isSecretName(candidate),
        );

        if (name !== undefined) {
          context.report({
            node,
            messageId: "comparison",
            data: { name, operator: node.operator },
          });
        }
      },
    };
  },
});
