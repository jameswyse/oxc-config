// Adapted from dmmulroy/anti-slop
import { defineRule } from "@oxlint/plugins";

import { resolveVariable } from "../shared/scope.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const moduleMockMethods = new Set(["doMock", "mock", "unstable_mockModule"]);

function importedName(node: ESTree.Node): string | null {
  if (node.type !== "ImportSpecifier") {
    return null;
  }

  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function isTestFrameworkObject(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
  if (expression.type !== "Identifier") {
    return false;
  }

  if (
    (expression.name === "vi" || expression.name === "jest") &&
    sourceCode.isGlobalReference(expression)
  ) {
    return true;
  }

  const variable = resolveVariable(sourceCode, expression);

  if (variable === null || variable.defs.length === 0) {
    return expression.name === "vi" || expression.name === "jest";
  }

  return variable.defs.some((definition) => {
    if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
      return false;
    }

    const source = definition.parent.source.value;
    const name = importedName(definition.node);

    return (
      ((source === "vitest" || source === "@effect/vitest") && name === "vi") ||
      (source === "@jest/globals" && name === "jest")
    );
  });
}

const nodeTestModules = ["node:test", "test"];

function isNodeTestMock(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
  if (expression.type === "MemberExpression") {
    return (
      !expression.computed &&
      expression.property.type === "Identifier" &&
      expression.property.name === "mock" &&
      expression.object.type === "Identifier" &&
      resolveVariable(sourceCode, expression.object)?.defs[0]?.type === "Parameter" &&
      sourceCode.ast.body.some(
        (statement) =>
          statement.type === "ImportDeclaration" &&
          nodeTestModules.includes(statement.source.value),
      )
    );
  }

  if (expression.type !== "Identifier") {
    return false;
  }

  return (
    resolveVariable(sourceCode, expression)?.defs.some(
      (definition) =>
        definition.type === "ImportBinding" &&
        definition.parent?.type === "ImportDeclaration" &&
        nodeTestModules.includes(definition.parent.source.value) &&
        importedName(definition.node) === "mock",
    ) ?? false
  );
}

function moduleMockCall(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
  if (!("property" in callee) || !("object" in callee) || !("computed" in callee)) {
    return false;
  }

  if (
    !callee.computed &&
    callee.property.type === "Identifier" &&
    callee.property.name === "module" &&
    isNodeTestMock(sourceCode, callee.object)
  ) {
    return true;
  }

  if (!isTestFrameworkObject(sourceCode, callee.object)) {
    return false;
  }

  const property = callee.property;

  const method = callee.computed
    ? property.type === "Literal" &&
      (property.value === "doMock" ||
        property.value === "mock" ||
        property.value === "unstable_mockModule")
      ? property.value
      : null
    : property.type === "Identifier"
      ? property.name
      : null;

  return method !== null && moduleMockMethods.has(method);
}

export const noModuleMocking = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Vitest and Jest module mocking; tests must replace dependencies through real interfaces.",
    },
    messages: {
      moduleMock:
        "Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") {
          return;
        }

        if (moduleMockCall(context.sourceCode, node.callee)) {
          context.report({ node, messageId: "moduleMock" });
        }
      },
    };
  },
});
