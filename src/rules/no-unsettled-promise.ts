import { defineRule } from "@oxlint/plugins";

import { isGlobal, isShortCircuited } from "../shared/index.ts";

import type { ESTree, Reference } from "@oxlint/plugins";

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

function isOptionallyReached(reference: Reference, executor: FunctionNode): boolean {
  let child: ESTree.Node = reference.identifier;

  for (
    let node: ESTree.Node | null = child.parent;
    node !== null && node !== executor;
    child = node, node = node.parent
  ) {
    const argument = child;

    if (
      node.type === "CallExpression" &&
      node.arguments.some((candidate) => candidate === argument) &&
      isShortCircuited(node)
    ) {
      return true;
    }
  }

  return false;
}

function doesNothing(executor: FunctionNode): boolean {
  const body = executor.body;

  if (body?.type === "BlockStatement") {
    return body.body.length === 0;
  }

  return (
    (body?.type === "Identifier" && body.name === "undefined") ||
    (body?.type === "UnaryExpression" &&
      body.operator === "void" &&
      body.argument.type === "Literal")
  );
}

function endsByThrowing(executor: FunctionNode): boolean {
  return (
    executor.body?.type === "BlockStatement" && executor.body.body.at(-1)?.type === "ThrowStatement"
  );
}

export const noUnsettledPromise = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require a Promise executor that runs code to settle the promise." },
    schema: [],
    messages: {
      unsettled:
        "This executor never calls `resolve` or `reject`, so the promise never settles. Return the underlying promise instead, or settle it when the work finishes.",
      optional:
        "This executor only settles inside an optional call, so the promise never settles when the target is missing. Settle it on both paths.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      NewExpression(node) {
        const [executor] = node.arguments;

        if (
          !isGlobal(sourceCode, node.callee, "Promise") ||
          (executor?.type !== "ArrowFunctionExpression" &&
            executor?.type !== "FunctionExpression") ||
          doesNothing(executor) ||
          endsByThrowing(executor) ||
          executor.params.some((parameter) => parameter.type !== "Identifier")
        ) {
          return;
        }

        const references = sourceCode
          .getDeclaredVariables(executor)
          .filter((variable) => variable.defs.some((definition) => definition.type === "Parameter"))
          .flatMap((variable) => variable.references);

        if (references.length === 0) {
          context.report({ node: executor, messageId: "unsettled" });
        } else if (references.every((reference) => isOptionallyReached(reference, executor))) {
          context.report({ node: executor, messageId: "optional" });
        }
      },
    };
  },
});
