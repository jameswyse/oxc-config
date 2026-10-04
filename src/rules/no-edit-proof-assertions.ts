import { defineRule } from "@oxlint/plugins";

import { variableFor, propertyName, apiReference } from "../shared/index.ts";
import { isStringLiteral } from "../vendor/anti-slop/effect/shared/tagged-values.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type Expectation = {
  readonly matcher: string;
  readonly negated: boolean;
  readonly actual: ESTree.Argument;
  readonly expected: readonly ESTree.Argument[];
};

type ImportKind = "namespace" | "binding";

const expectModules = new Set([
  "vitest",
  "@effect/vitest",
  "@jest/globals",
  "@playwright/test",
  "playwright/test",
  "global",
]);

const presenceMatchers = new Map<string, boolean>([
  ["toBeDefined", false],
  ["toBeTruthy", false],
  ["toBeUndefined", true],
  ["toBeFalsy", true],
  ["toBeNull", true],
]);

const equalityMatchers = new Set(["toBe", "toEqual", "toStrictEqual"]);

function expectation(sourceCode: SourceCode, node: ESTree.CallExpression): Expectation | null {
  if (node.callee.type !== "MemberExpression") {
    return null;
  }

  const matcher = propertyName(node.callee);
  let target = node.callee.object;
  let negated = false;

  if (target.type === "MemberExpression" && propertyName(target) === "not") {
    negated = true;
    target = target.object;
  }

  if (!matcher || target.type !== "CallExpression") {
    return null;
  }

  const [actual] = target.arguments;

  if (actual === undefined) {
    return null;
  }

  const callee =
    target.callee.type === "MemberExpression" && propertyName(target.callee) === "soft"
      ? target.callee.object
      : target.callee;

  const api = apiReference(sourceCode, callee);

  if (api?.name !== "expect" || !expectModules.has(api.module)) {
    return null;
  }

  return { matcher, negated, actual, expected: node.arguments };
}

function dynamicImport(node: ESTree.Expression | null): boolean {
  return node?.type === "AwaitExpression" && node.argument.type === "ImportExpression";
}

function importKind(sourceCode: SourceCode, node: ESTree.Node): ImportKind | null {
  if (node.type !== "Identifier") {
    return null;
  }

  const variable = variableFor(sourceCode, node);
  const definition = variable?.defs.length === 1 ? variable.defs[0] : undefined;

  if (definition === undefined) {
    return null;
  }

  if (definition.type === "ImportBinding") {
    return definition.node.type === "ImportNamespaceSpecifier" ? "namespace" : "binding";
  }

  if (
    definition.type === "Variable" &&
    definition.parent?.type === "VariableDeclaration" &&
    definition.parent.kind === "const" &&
    definition.node.type === "VariableDeclarator" &&
    dynamicImport(definition.node.init)
  ) {
    return definition.node.id.type === "Identifier" ? "namespace" : "binding";
  }

  return null;
}

function importedValue(sourceCode: SourceCode, node: ESTree.Node): boolean {
  if (node.type === "Identifier") {
    return importKind(sourceCode, node) !== null;
  }

  return (
    node.type === "MemberExpression" &&
    propertyName(node) !== null &&
    importKind(sourceCode, node.object) === "namespace"
  );
}

function editProof(
  sourceCode: SourceCode,
  { matcher, negated, actual, expected }: Expectation,
): boolean {
  if (presenceMatchers.has(matcher)) {
    return presenceMatchers.get(matcher) === negated && importedValue(sourceCode, actual);
  }

  const [first] = expected;

  if (negated || !isStringLiteral(first)) {
    return false;
  }

  const functionType = first.value === "function";

  if (matcher === "toBeTypeOf") {
    return functionType || importedValue(sourceCode, actual);
  }

  if (equalityMatchers.has(matcher)) {
    return (
      actual.type === "UnaryExpression" &&
      actual.operator === "typeof" &&
      (functionType || importedValue(sourceCode, actual.argument))
    );
  }

  return matcher === "toHaveProperty" && importKind(sourceCode, actual) === "namespace";
}

export const noEditProofAssertions = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Assert behaviour instead of proving that an import exists or that a value is a function.",
    },
    schema: [],
    messages: {
      editProof:
        "This assertion only proves that an import exists or that a value is a function. Call it and assert the behaviour it provides.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const assertion = expectation(sourceCode, node);

        if (assertion && editProof(sourceCode, assertion)) {
          context.report({ node, messageId: "editProof" });
        }
      },
    };
  },
});
