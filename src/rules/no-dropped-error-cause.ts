import { defineRule } from "@oxlint/plugins";

import {
  effectMember,
  ownReturns,
  pipeSteps,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

import type { FunctionNode } from "../shared/index.ts";

const errorMappers = new Set(["mapError", "mapErrorEager"]);

const broadRecoveries = new Set([
  "catch",
  "catchAll",
  "catchAllCause",
  "catchCause",
  "catchCauseFilter",
  "catchCauseIf",
  "catchEager",
  "catchFilter",
  "catchIf",
]);

function isHandler(node: ESTree.Node): node is ESTree.ArrowFunctionExpression | ESTree.Function {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression";
}

function ignoresError(sourceCode: SourceCode, handler: FunctionNode) {
  const [parameter] = handler.params;

  if (parameter === undefined) {
    return true;
  }

  if (parameter.type !== "Identifier") {
    return false;
  }

  return variableFor(sourceCode, parameter)?.references.length === 0;
}

const errorTaps = new Set(["tapCause", "tapError", "tapErrorCause"]);

function isErrorTap(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  if (value.type !== "CallExpression") {
    return false;
  }

  const name = effectMember(sourceCode, value.callee, "Effect");
  const [tap] = value.arguments;

  return (
    name !== null &&
    errorTaps.has(name) &&
    tap !== undefined &&
    tap.type !== "SpreadElement" &&
    !(isHandler(tap) && ignoresError(sourceCode, tap))
  );
}

function followsErrorTap(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const pipe = node.parent.type === "CallExpression" ? pipeSteps(sourceCode, node.parent) : null;
  const position = pipe?.steps.indexOf(node) ?? -1;
  const previous = position > 0 ? pipe?.steps[position - 1] : undefined;

  return previous !== undefined && isErrorTap(sourceCode, previous);
}

function isNewError(node: ESTree.Node) {
  const value = unwrapExpression(node);

  if (value.type === "NewExpression") {
    return true;
  }

  if (value.type !== "CallExpression") {
    return false;
  }

  const callee = unwrapExpression(value.callee);

  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === "make"
  );
}

function isFailWithNewError(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  if (
    value.type !== "CallExpression" ||
    effectMember(sourceCode, value.callee, "Effect") !== "fail"
  ) {
    return false;
  }

  const [error] = value.arguments;

  return error !== undefined && error.type !== "SpreadElement" && isNewError(error);
}

export const noDroppedErrorCause = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Effect error handlers that create a new error to read the original, so it can be kept as the cause.",
    },
    messages: {
      dropped:
        "This handler replaces the original error without keeping it, so logs and traces lose the real failure. Name the handler's parameter and pass it to the new error as `cause`, or log it with `Effect.tapError` first when the new error is sent to clients.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const name = effectMember(context.sourceCode, node.callee, "Effect");

        if (name === null || (!errorMappers.has(name) && !broadRecoveries.has(name))) {
          return;
        }

        const replacesError = errorMappers.has(name)
          ? isNewError
          : (returned: ESTree.Node) => isFailWithNewError(context.sourceCode, returned);

        const handlers = node.arguments.filter(
          (argument): argument is FunctionNode =>
            isHandler(argument) && ignoresError(context.sourceCode, argument),
        );

        if (handlers.length === 0 || followsErrorTap(context.sourceCode, node)) {
          return;
        }

        for (const handler of handlers) {
          for (const returned of ownReturns(handler, context.sourceCode.visitorKeys)) {
            if (replacesError(returned)) {
              context.report({ node: returned, messageId: "dropped" });
            }
          }
        }
      },
    };
  },
});
