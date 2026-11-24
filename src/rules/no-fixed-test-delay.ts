import { defineRule } from "@oxlint/plugins";

import {
  variableFor,
  isGlobal,
  staticPropertyName,
  apiReference,
  importedBinding,
  isEffectModule,
  isFunctionNode,
  outermostExpression,
  testContext,
  unwrapExpression,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

import type { FunctionNode, TestContext } from "../shared/index.ts";

function constantValue(sourceCode: SourceCode, argument: ESTree.Node | null | undefined) {
  const node = argument ? unwrapExpression(argument) : argument;

  if (node?.type !== "Identifier") {
    return node;
  }

  const [definition, ...others] = variableFor(sourceCode, node)?.defs ?? [];
  const declarator = definition?.node;

  return others.length === 0 &&
    definition?.type === "Variable" &&
    definition.parent?.type === "VariableDeclaration" &&
    definition.parent.kind === "const" &&
    declarator?.type === "VariableDeclarator" &&
    declarator.init
    ? unwrapExpression(declarator.init)
    : node;
}

function numericLiteral(sourceCode: SourceCode, argument: ESTree.Node | null | undefined) {
  const node = constantValue(sourceCode, argument);

  return (
    (node?.type === "Literal" && typeof node.value === "number") ||
    (node?.type === "UnaryExpression" &&
      ["+", "-"].includes(node.operator) &&
      node.argument.type === "Literal" &&
      typeof node.argument.value === "number")
  );
}

function globalTimer(sourceCode: SourceCode, callee: ESTree.Expression) {
  if (isGlobal(sourceCode, callee, "setTimeout")) {
    return true;
  }

  return (
    callee.type === "MemberExpression" &&
    staticPropertyName(callee) === "setTimeout" &&
    ["globalThis", "global", "window"].some((name) => isGlobal(sourceCode, callee.object, name))
  );
}

const timerModules = ["node:timers/promises", "timers/promises"];

function isScheduler(sourceCode: SourceCode, node: ESTree.Expression) {
  const api = apiReference(sourceCode, node);

  return (
    (api?.name === "scheduler" && timerModules.includes(api.module)) ||
    isGlobal(sourceCode, node, "scheduler")
  );
}

function isBunSleep(sourceCode: SourceCode, callee: ESTree.Expression) {
  const binding = importedBinding(sourceCode, callee);

  return binding?.source === "bun" && binding.name === "sleep";
}

function isRuntimeSleep(sourceCode: SourceCode, callee: ESTree.Expression) {
  if (isBunSleep(sourceCode, callee)) {
    return true;
  }

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const method = staticPropertyName(callee);

  return (
    (method === "wait" && isScheduler(sourceCode, callee.object)) ||
    (method === "sleep" && isGlobal(sourceCode, callee.object, "Bun"))
  );
}

function singleExpression(body: ESTree.FunctionBody | ESTree.Expression | null) {
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
) {
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

function timerPromiseDelay(sourceCode: SourceCode, node: ESTree.NewExpression) {
  if (!isGlobal(sourceCode, node.callee, "Promise")) {
    return null;
  }

  const executor = node.arguments[0];

  if (
    !executor ||
    (executor.type !== "ArrowFunctionExpression" && executor.type !== "FunctionExpression") ||
    executor.generator
  ) {
    return null;
  }

  const resolve = executor.params[0];

  if (resolve?.type !== "Identifier") {
    return null;
  }

  const timer = singleExpression(executor.body);

  if (
    timer?.type !== "CallExpression" ||
    !globalTimer(sourceCode, timer.callee) ||
    !resolvesWithoutValue(sourceCode, timer.arguments[0], resolve)
  ) {
    return null;
  }

  return timer.arguments[1] ?? null;
}

function sleepDelay(sourceCode: SourceCode, node: ESTree.Node) {
  if (node.type === "NewExpression") {
    return timerPromiseDelay(sourceCode, node);
  }

  if (node.type !== "CallExpression") {
    return null;
  }

  const api = apiReference(sourceCode, node.callee);

  const sleeps =
    (api?.name === "setTimeout" && timerModules.includes(api.module)) ||
    isRuntimeSleep(sourceCode, node.callee);

  return sleeps ? (node.arguments[0] ?? null) : null;
}

function sameFileHelper(sourceCode: SourceCode, callee: ESTree.Expression) {
  if (callee.type !== "Identifier") {
    return null;
  }

  const [definition, ...others] = variableFor(sourceCode, callee)?.defs ?? [];

  if (!definition || others.length > 0) {
    return null;
  }

  if (definition.type === "FunctionName") {
    return definition.node.type === "FunctionDeclaration" ? definition.node : null;
  }

  const value = constantValue(sourceCode, callee);

  return value?.type === "ArrowFunctionExpression" || value?.type === "FunctionExpression"
    ? value
    : null;
}

function soleAwaitedOrReturned(body: ESTree.FunctionBody | ESTree.Expression | null) {
  if (body === null || body.type !== "BlockStatement") {
    return body;
  }

  const [statement, ...others] = body.body;

  if (others.length > 0) {
    return null;
  }

  if (statement?.type === "ReturnStatement") {
    return statement.argument;
  }

  return statement?.type === "ExpressionStatement" &&
    statement.expression.type === "AwaitExpression"
    ? statement.expression
    : null;
}

function helperSleepDelay(sourceCode: SourceCode, helper: FunctionNode) {
  if (helper.generator) {
    return null;
  }

  const result = soleAwaitedOrReturned(helper.body);
  const value = result ? unwrapExpression(result) : null;
  const awaited = value?.type === "AwaitExpression" ? value.argument : value;

  return awaited ? sleepDelay(sourceCode, unwrapExpression(awaited)) : null;
}

function unchangedParameterIndex(sourceCode: SourceCode, helper: FunctionNode, node: ESTree.Node) {
  const variable = variableFor(sourceCode, unwrapExpression(node));
  const [definition, ...others] = variable?.defs ?? [];

  if (
    !variable ||
    definition?.type !== "Parameter" ||
    others.length > 0 ||
    variable.references.some((reference) => reference.isWrite() && !reference.init)
  ) {
    return -1;
  }

  return helper.params.findIndex(
    (parameter) =>
      parameter === definition.name ||
      (parameter.type === "AssignmentPattern" && parameter.left === definition.name),
  );
}

function callsFixedSleepHelper(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const helper = sameFileHelper(sourceCode, call.callee);
  const delay = helper ? helperSleepDelay(sourceCode, helper) : null;

  if (!helper || !delay) {
    return false;
  }

  if (numericLiteral(sourceCode, delay)) {
    return true;
  }

  const index = unchangedParameterIndex(sourceCode, helper, delay);
  const parameter = helper.params[index];

  if (!parameter) {
    return false;
  }

  if (call.arguments.slice(0, index + 1).some((argument) => argument.type === "SpreadElement")) {
    return false;
  }

  const argument = call.arguments[index];

  if (argument && !isGlobal(sourceCode, unwrapExpression(argument), "undefined")) {
    return numericLiteral(sourceCode, argument);
  }

  return parameter.type === "AssignmentPattern" && numericLiteral(sourceCode, parameter.right);
}

function enclosingFunction(node: ESTree.Node) {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (isFunctionNode(ancestor)) {
      return ancestor;
    }
  }

  return null;
}

function isAwaited(node: ESTree.Node) {
  return outermostExpression(node).parent?.type === "AwaitExpression";
}

function returningFunction(node: ESTree.Node) {
  const expression = outermostExpression(node);
  const parent = expression.parent;

  if (parent?.type === "ReturnStatement") {
    return enclosingFunction(parent);
  }

  return parent?.type === "ArrowFunctionExpression" && parent.body === expression ? parent : null;
}

function awaitedByTest(node: ESTree.Node, test: TestContext) {
  return isAwaited(node) || returningFunction(node) === test.callback;
}

function isFixedDuration(sourceCode: SourceCode, argument: ESTree.Argument | undefined) {
  const node = constantValue(sourceCode, argument);

  if (node?.type === "Literal") {
    return typeof node.value === "string" || typeof node.value === "number";
  }

  const owner =
    node?.type === "CallExpression" && node.callee.type === "MemberExpression"
      ? node.callee.object
      : null;

  return (
    node?.type === "CallExpression" &&
    owner !== null &&
    isEffectModule(sourceCode, owner, "Duration") &&
    node.arguments.length > 0 &&
    node.arguments.every((item) => numericLiteral(sourceCode, item))
  );
}

function isEffectSleep(sourceCode: SourceCode, node: ESTree.CallExpression) {
  return (
    node.callee.type === "MemberExpression" &&
    staticPropertyName(node.callee) === "sleep" &&
    isEffectModule(sourceCode, node.callee.object, "Effect") &&
    isFixedDuration(sourceCode, node.arguments[0])
  );
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
        if (
          node.parent.type === "YieldExpression" &&
          node.parent.delegate &&
          isEffectSleep(sourceCode, node) &&
          testContext(sourceCode, node)
        ) {
          context.report({ node, messageId: "delay" });
        }

        if (
          node.callee.type === "MemberExpression" &&
          staticPropertyName(node.callee) === "waitForTimeout"
        ) {
          context.report({ node, messageId: "delay" });

          return;
        }

        if (!isAwaited(node) && !returningFunction(node)) {
          return;
        }

        const test = testContext(sourceCode, node);

        if (!test || !awaitedByTest(node, test)) {
          return;
        }

        if (
          numericLiteral(sourceCode, sleepDelay(sourceCode, node)) ||
          callsFixedSleepHelper(sourceCode, node)
        ) {
          context.report({ node, messageId: "delay" });
        }
      },
      NewExpression(node) {
        if (!numericLiteral(sourceCode, timerPromiseDelay(sourceCode, node))) {
          return;
        }

        const test = testContext(sourceCode, node);

        if (test && awaitedByTest(node, test)) {
          context.report({ node, messageId: "delay" });
        }
      },
    };
  },
});
