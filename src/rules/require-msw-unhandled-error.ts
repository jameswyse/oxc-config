import { defineRule } from "@oxlint/plugins";

import {
  constantString,
  importedBinding,
  isFunctionNode,
  staticPropertyName,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";
import { isNullishValue, resolveProperty, valueBranches } from "../shared/object-properties.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

const setupFunctions = new Map([
  ["listen", "setupServer"],
  ["start", "setupWorker"],
]);

function isMswModule(source: string) {
  return source === "msw" || source.startsWith("msw/");
}

function isSetupCall(sourceCode: SourceCode, node: ESTree.Node, setup: string) {
  const call = unwrapExpression(node);
  const binding = call.type === "CallExpression" ? importedBinding(sourceCode, call.callee) : null;

  return binding !== null && isMswModule(binding.source) && binding.name === setup;
}

function assignedValue(reference: Variable["references"][number]) {
  const target = reference.identifier;
  const parent = target.parent;

  if (parent.type === "VariableDeclarator" && parent.id === target) {
    return parent.init;
  }

  return parent.type === "AssignmentExpression" && parent.operator === "=" && parent.left === target
    ? parent.right
    : null;
}

function isSetupInstance(
  sourceCode: SourceCode,
  node: ESTree.Node,
  setup: string,
  visited: ReadonlySet<Variable> = new Set(),
): boolean {
  const value = unwrapExpression(node);

  if (value.type !== "Identifier") {
    return isSetupCall(sourceCode, value, setup);
  }

  const variable = variableFor(sourceCode, value);

  if (
    variable === null ||
    visited.has(variable) ||
    !variable.defs.every((definition) => definition.type === "Variable")
  ) {
    return false;
  }

  const assigned = variable.references
    .filter((reference) => reference.isWrite())
    .map(assignedValue)
    .filter((write) => write === null || !isNullishValue(sourceCode, write));

  return (
    assigned.length > 0 &&
    assigned.every(
      (write) =>
        write !== null &&
        isSetupInstance(sourceCode, write, setup, new Set([...visited, variable])),
    )
  );
}

function isFunctionValue(sourceCode: SourceCode, node: ESTree.Node) {
  return isFunctionNode(node) || variableFor(sourceCode, node)?.defs[0]?.type === "FunctionName";
}

type Strictness = "strict" | "lenient" | "unknown";

function combined(branches: readonly Strictness[]) {
  if (branches.includes("lenient")) {
    return "lenient";
  }

  return branches.every((branch) => branch === "strict") ? "strict" : "unknown";
}

function settingStrictness(sourceCode: SourceCode, node: ESTree.Node) {
  if (isNullishValue(sourceCode, node)) {
    return "lenient";
  }

  const text = constantString(sourceCode, node);

  if (text !== null) {
    return text === "error" ? "strict" : "lenient";
  }

  return isFunctionValue(sourceCode, node) ? "strict" : "unknown";
}

function optionStrictness(sourceCode: SourceCode, node: ESTree.Node) {
  if (isNullishValue(sourceCode, node)) {
    return "lenient";
  }

  const setting = resolveProperty(sourceCode, node, "onUnhandledRequest");

  if (setting.kind === "known") {
    return combined(
      valueBranches(sourceCode, setting.value).map((branch) =>
        settingStrictness(sourceCode, branch),
      ),
    );
  }

  return setting.kind === "unknown" ? "unknown" : "lenient";
}

function optionsStrictness(sourceCode: SourceCode, node: ESTree.Node) {
  return combined(
    valueBranches(sourceCode, node).map((options) => optionStrictness(sourceCode, options)),
  );
}

function isLenient(sourceCode: SourceCode, options: ESTree.Argument | undefined) {
  return (
    options === undefined ||
    (options.type !== "SpreadElement" && optionsStrictness(sourceCode, options) === "lenient")
  );
}

export const requireMswUnhandledError = defineRule({
  meta: {
    type: "problem",
    docs: { description: 'Require MSW to start with onUnhandledRequest: "error".' },
    schema: [],
    messages: {
      lenient:
        'Start MSW with `{ onUnhandledRequest: "error" }` and add a handler for each request the test makes.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const callee = unwrapExpression(node.callee);
        const method = callee.type === "MemberExpression" ? staticPropertyName(callee) : null;
        const setup = method === null ? undefined : setupFunctions.get(method);

        if (
          callee.type !== "MemberExpression" ||
          setup === undefined ||
          !isSetupInstance(sourceCode, callee.object, setup)
        ) {
          return;
        }

        if (isLenient(sourceCode, node.arguments[0])) {
          context.report({ node, messageId: "lenient" });
        }
      },
    };
  },
});
