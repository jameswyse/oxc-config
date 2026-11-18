import { defineRule } from "@oxlint/plugins";

import {
  effectMember,
  pipeSteps,
  propertyName,
  unchangedInit,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const retries = new Set(["retry", "retryOrElse"]);

const endlessSchedules = new Set([
  "cron",
  "exponential",
  "fibonacci",
  "fixed",
  "linear",
  "spaced",
  "windowed",
]);

const delayAdjustments = new Set([
  "addDelay",
  "delayed",
  "jittered",
  "map",
  "modifyDelay",
  "passthrough",
  "setInputType",
  "tap",
  "tapInput",
  "tapOutput",
]);

const retryLimits = ["times", "while", "until"];

const expressionWrappers = new Set([
  "ParenthesizedExpression",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

const maxDepth = 32;

function resolved(sourceCode: SourceCode, node: ESTree.Node, depth: number): ESTree.Node {
  const value = unwrapExpression(node);

  const variable =
    value.type === "Identifier" && depth < maxDepth ? variableFor(sourceCode, value) : null;

  const initializer = variable === null ? null : unchangedInit(variable);

  return initializer === null ? value : resolved(sourceCode, initializer, depth + 1);
}

function isDelayAdjustment(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);
  const operator = value.type === "CallExpression" ? value.callee : value;
  const name = effectMember(sourceCode, operator, "Schedule");

  return name !== null && delayAdjustments.has(name);
}

const endlessness = new WeakMap<ESTree.Node, boolean>();

function isEndless(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const value = resolved(sourceCode, node, 0);
  const known = endlessness.get(value);

  if (known !== undefined) {
    return known;
  }

  endlessness.set(value, false);

  const endless = (() => {
    if (effectMember(sourceCode, value, "Schedule") === "forever") {
      return true;
    }

    if (value.type !== "CallExpression") {
      return false;
    }

    const operator = effectMember(sourceCode, value.callee, "Schedule");
    const [first] = value.arguments;

    if (operator !== null && endlessSchedules.has(operator)) {
      return true;
    }

    if (operator !== null && delayAdjustments.has(operator)) {
      return first !== undefined && isEndless(sourceCode, first);
    }

    if ((operator === "min" || operator === "max") && first?.type === "ArrayExpression") {
      return first.elements.every(
        (element) =>
          element !== null && element.type !== "SpreadElement" && isEndless(sourceCode, element),
      );
    }

    const pipe = pipeSteps(sourceCode, value);

    return (
      pipe !== null &&
      pipe.input !== null &&
      isEndless(sourceCode, pipe.input) &&
      pipe.steps.every((step) => isDelayAdjustment(sourceCode, step))
    );
  })();

  endlessness.set(value, endless);

  return endless;
}

function optionValues(options: ESTree.ObjectExpression) {
  const values = new Map<string, ESTree.Node>();

  for (const property of options.properties) {
    const name = property.type === "Property" ? propertyName(property) : null;

    if (property.type !== "Property" || name === null) {
      return null;
    }

    values.set(name, property.value);
  }

  return values;
}

function isEndlessPolicy(sourceCode: SourceCode, node: ESTree.Node) {
  const policy = resolved(sourceCode, node, 0);

  if (policy.type !== "ObjectExpression") {
    return isEndless(sourceCode, policy);
  }

  const options = optionValues(policy);
  const schedule = options?.get("schedule");

  if (options === null || retryLimits.some((limit) => options.has(limit))) {
    return false;
  }

  return schedule === undefined || isEndless(sourceCode, schedule);
}

function isTimeout(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);
  const operator = value.type === "CallExpression" ? value.callee : value;

  return effectMember(sourceCode, operator, "Effect")?.startsWith("timeout") === true;
}

function isTimedOut(sourceCode: SourceCode, child: ESTree.Node): boolean {
  const parent = child.parent;

  if (parent === null) {
    return false;
  }

  if (
    expressionWrappers.has(parent.type) ||
    (parent.type === "MemberExpression" && parent.object === child)
  ) {
    return isTimedOut(sourceCode, parent);
  }

  if (parent.type !== "CallExpression") {
    return false;
  }

  if (
    parent.arguments[0] === child &&
    (isTimeout(sourceCode, parent) || isTimeout(sourceCode, parent.callee))
  ) {
    return true;
  }

  const pipe = pipeSteps(sourceCode, parent);

  if (pipe === null) {
    return false;
  }

  const later = pipe.steps.slice(pipe.steps.indexOf(child) + 1);

  return later.some((step) => isTimeout(sourceCode, step)) || isTimedOut(sourceCode, parent);
}

function retryPolicy(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const name = effectMember(sourceCode, node.callee, "Effect");

  if (name === null || !retries.has(name)) {
    return null;
  }

  const policies = node.arguments.filter((argument) => argument.type !== "SpreadElement");

  return (name === "retryOrElse" ? policies.at(-2) : policies.at(-1)) ?? null;
}

export const noUnboundedRetry = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require Effect retries to stop after a number of attempts, a duration or a timeout, or to retry only chosen errors.",
    },
    messages: {
      unbounded:
        "This retry repeats every failure forever, so a lasting fault hangs the caller and hides the error. Limit it with `times`, `Schedule.recurs` or `Schedule.during`, follow it with a timeout, or choose the errors that are worth retrying with `while`.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const policy = retryPolicy(context.sourceCode, node);

        if (
          policy !== null &&
          isEndlessPolicy(context.sourceCode, policy) &&
          !isTimedOut(context.sourceCode, node)
        ) {
          context.report({ node: policy, messageId: "unbounded" });
        }
      },
    };
  },
});
