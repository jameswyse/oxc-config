import { defineRule } from "@oxlint/plugins";

import { variableFor, propertyName, apiReference } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

const equalityMatchers = new Set(["toBe", "toEqual", "toStrictEqual"]);

function isSingleArgumentList(values: readonly ESTree.Argument[]): values is [ESTree.Argument] {
  return values.length === 1;
}

function primitiveLiteral(node: ESTree.Argument): boolean {
  if (node.type === "Literal") {
    return (
      !("regex" in node) &&
      (node.value === null || ["string", "number", "boolean", "bigint"].includes(typeof node.value))
    );
  }

  return (
    node.type === "UnaryExpression" &&
    ["+", "-"].includes(node.operator) &&
    node.argument.type === "Literal" &&
    ["number", "bigint"].includes(typeof node.argument.value)
  );
}

export const noVacuousTestAssertions = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Assert runtime behaviour instead of literals or a value compared with itself.",
    },
    schema: [],
    messages: {
      vacuous:
        "This assertion compares fixed values or a value with itself. Assert an independently expected runtime result.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || !isSingleArgumentList(node.arguments)) {
          return;
        }

        const matcher = propertyName(node.callee);

        if (matcher === null || !equalityMatchers.has(matcher)) {
          return;
        }

        let actualCall = node.callee.object;

        if (actualCall.type === "MemberExpression" && propertyName(actualCall) === "not") {
          actualCall = actualCall.object;
        }

        if (actualCall.type !== "CallExpression" || !isSingleArgumentList(actualCall.arguments)) {
          return;
        }

        const api = apiReference(sourceCode, actualCall.callee);

        if (
          api?.name !== "expect" ||
          ![
            "vitest",
            "@effect/vitest",
            "@jest/globals",
            "@playwright/test",
            "playwright/test",
            "global",
          ].includes(api.module)
        ) {
          return;
        }

        const actual = actualCall.arguments[0];
        const expected = node.arguments[0];
        const literals = primitiveLiteral(actual) && primitiveLiteral(expected);

        const sameBinding =
          actual.type === "Identifier" &&
          expected.type === "Identifier" &&
          actual.name === expected.name &&
          variableFor(sourceCode, actual) === variableFor(sourceCode, expected);

        if (literals || sameBinding) {
          context.report({ node, messageId: "vacuous" });
        }
      },
    };
  },
});
