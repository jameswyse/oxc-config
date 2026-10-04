import { defineRule } from "@oxlint/plugins";

import {
  variableFor,
  isGlobal,
  propertyName,
  isPlaywright,
  apiReference,
  testContext,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

import type { TestContext } from "../shared/index.ts";

function numericLiteral(node: ESTree.Argument | undefined): boolean {
  return (
    (node?.type === "Literal" && typeof node.value === "number") ||
    (node?.type === "UnaryExpression" &&
      ["+", "-"].includes(node.operator) &&
      node.argument.type === "Literal" &&
      typeof node.argument.value === "number")
  );
}

function globalTimer(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
  if (isGlobal(sourceCode, callee, "setTimeout")) {
    return true;
  }

  return (
    callee.type === "MemberExpression" &&
    propertyName(callee) === "setTimeout" &&
    ["globalThis", "global", "window"].some((name) => isGlobal(sourceCode, callee.object, name))
  );
}

function singleExpression(
  body: ESTree.FunctionBody | ESTree.Expression | null,
): ESTree.Expression | null {
  if (body === null) {
    return null;
  }

  if (body.type !== "BlockStatement") {
    return body;
  }

  if (body.body.length !== 1) {
    return null;
  }

  const statement = body.body[0];

  if (statement?.type === "ExpressionStatement") {
    return statement.expression;
  }

  return statement?.type === "ReturnStatement" ? statement.argument : null;
}

function resolvesWithoutValue(
  sourceCode: SourceCode,
  callback: ESTree.Argument | undefined,
  resolve: ESTree.BindingIdentifier,
): boolean {
  if (callback?.type === "Identifier") {
    return variableFor(sourceCode, callback) === variableFor(sourceCode, resolve);
  }

  if (
    !callback ||
    (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") ||
    callback.params.length !== 0 ||
    callback.generator
  ) {
    return false;
  }

  const call = singleExpression(callback.body);

  return (
    call?.type === "CallExpression" &&
    call.arguments.length === 0 &&
    call.callee.type === "Identifier" &&
    variableFor(sourceCode, call.callee) === variableFor(sourceCode, resolve)
  );
}

function timerPromise(sourceCode: SourceCode, node: ESTree.NewExpression): boolean {
  if (!isGlobal(sourceCode, node.callee, "Promise")) {
    return false;
  }

  const executor = node.arguments[0];

  if (
    !executor ||
    (executor.type !== "ArrowFunctionExpression" && executor.type !== "FunctionExpression") ||
    executor.generator
  ) {
    return false;
  }

  const resolve = executor.params[0];

  if (resolve?.type !== "Identifier") {
    return false;
  }

  const timer = singleExpression(executor.body);

  if (
    timer?.type !== "CallExpression" ||
    !globalTimer(sourceCode, timer.callee) ||
    !numericLiteral(timer.arguments[1])
  ) {
    return false;
  }

  return resolvesWithoutValue(sourceCode, timer.arguments[0], resolve);
}

function playwrightPage(
  sourceCode: SourceCode,
  node: ESTree.Expression,
  enclosing: TestContext,
): boolean {
  if (!isPlaywright(enclosing.api.module) || node.type !== "Identifier") {
    return false;
  }

  const fixtures = enclosing.callback.params[0];

  if (fixtures?.type !== "ObjectPattern") {
    return false;
  }

  return fixtures.properties.some((property) => {
    if (property.type !== "Property" || propertyName(property) !== "page") {
      return false;
    }

    const binding =
      property.value.type === "AssignmentPattern" ? property.value.left : property.value;

    return (
      binding.type === "Identifier" &&
      variableFor(sourceCode, binding) === variableFor(sourceCode, node)
    );
  });
}

export const noFixedTestDelay = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Wait for observable test outcomes instead of a fixed timer." },
    schema: [],
    messages: {
      delay:
        "Wait for an observable condition or control the clock instead of waiting for a fixed delay.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        if (node.parent.type !== "AwaitExpression") {
          return;
        }

        const enclosing = testContext(sourceCode, node);

        if (!enclosing) {
          return;
        }

        const api = apiReference(sourceCode, node.callee);

        const importedTimer =
          api?.name === "setTimeout" &&
          ["node:timers/promises", "timers/promises"].includes(api.module) &&
          numericLiteral(node.arguments[0]);

        const browserTimer =
          node.callee.type === "MemberExpression" &&
          propertyName(node.callee) === "waitForTimeout" &&
          numericLiteral(node.arguments[0]) &&
          playwrightPage(sourceCode, node.callee.object, enclosing);

        if (importedTimer || browserTimer) {
          context.report({ node, messageId: "delay" });
        }
      },
      NewExpression(node) {
        if (
          node.parent.type === "AwaitExpression" &&
          testContext(sourceCode, node) &&
          timerPromise(sourceCode, node)
        ) {
          context.report({ node, messageId: "delay" });
        }
      },
    };
  },
});
