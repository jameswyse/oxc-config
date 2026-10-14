import { defineRule } from "@oxlint/plugins";

import { isShortCircuited, testContext } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

function isStep(chain: ESTree.ChainExpression): boolean {
  const step = chain.parent.type === "AwaitExpression" ? chain.parent : chain;
  const position = step.parent;

  return (
    position.type === "ExpressionStatement" ||
    position.type === "ReturnStatement" ||
    (position.type === "ArrowFunctionExpression" && position.body === step)
  );
}

function enclosingFunction(node: ESTree.Node): ESTree.Node | null {
  for (let ancestor = node.parent; ancestor !== null; ancestor = ancestor.parent) {
    if (
      ancestor.type === "ArrowFunctionExpression" ||
      ancestor.type === "FunctionExpression" ||
      ancestor.type === "FunctionDeclaration"
    ) {
      return ancestor;
    }
  }

  return null;
}

export const noOptionalTestAction = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow test steps that an optional call can silently skip." },
    schema: [],
    messages: {
      optional:
        "This optional call skips the step when its target is missing, so the test can pass without doing it. Get the target with a query that fails when it's absent.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      ChainExpression(node) {
        const call = node.expression;

        if (call.type !== "CallExpression" || !isShortCircuited(call) || !isStep(node)) {
          return;
        }

        const test = testContext(sourceCode, node);

        if (
          (test?.api.name === "test" || test?.api.name === "it") &&
          enclosingFunction(node) === test.callback
        ) {
          context.report({ node: call, messageId: "optional" });
        }
      },
    };
  },
});
