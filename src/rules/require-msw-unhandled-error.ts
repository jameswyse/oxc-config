import { createRequire } from "node:module";
import { dirname } from "node:path";

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
import { readPackageManifest } from "../shared/package-manifest.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

const setupFunctions = new Map([
  ["listen", "setupServer"],
  ["start", "setupWorker"],
]);

function installedMswVersion(filename: string) {
  try {
    const manifest = createRequire(filename).resolve("msw/package.json");

    return readPackageManifest(dirname(manifest))?.get("version");
  } catch {
    return undefined;
  }
}

function unhandledOption(filename: string) {
  const version = installedMswVersion(filename);

  return typeof version === "string" && Number.parseInt(version, 10) < 3
    ? "onUnhandledRequest"
    : "onUnhandledFrame";
}

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

function optionStrictness(sourceCode: SourceCode, node: ESTree.Node, option: string) {
  if (isNullishValue(sourceCode, node)) {
    return "lenient";
  }

  const setting = resolveProperty(sourceCode, node, option);

  if (setting.kind === "known") {
    return combined(
      valueBranches(sourceCode, setting.value).map((branch) =>
        settingStrictness(sourceCode, branch),
      ),
    );
  }

  return setting.kind === "unknown" ? "unknown" : "lenient";
}

function optionsStrictness(sourceCode: SourceCode, node: ESTree.Node, option: string) {
  return combined(
    valueBranches(sourceCode, node).map((options) => optionStrictness(sourceCode, options, option)),
  );
}

function isLenient(sourceCode: SourceCode, options: ESTree.Argument | undefined, option: string) {
  return (
    options === undefined ||
    (options.type !== "SpreadElement" &&
      optionsStrictness(sourceCode, options, option) === "lenient")
  );
}

export const requireMswUnhandledError = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require MSW to fail on unhandled requests." },
    schema: [],
    messages: {
      lenient:
        'Start MSW with `{ {{option}}: "error" }` and add a handler for each request the test makes.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    let option: string | undefined;

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

        option ??= unhandledOption(context.filename);

        if (isLenient(sourceCode, node.arguments[0], option)) {
          context.report({ node, messageId: "lenient", data: { option } });
        }
      },
    };
  },
});
