import {
  apiReference,
  functionUses,
  importedBinding,
  isFunctionNode,
  isGlobal,
  propertyName,
  staticPropertyName,
  unwrapExpression,
  variableFor,
  vitestModules,
} from "../../../shared/index.ts";
import { resolveProperty } from "../../../shared/object-properties.ts";

// Adapted from dmmulroy/anti-slop
import type { ESTree, SourceCode } from "@oxlint/plugins";

import type { FunctionNode } from "../../../shared/index.ts";

export type TestFramework = "vi" | "jest";

export type TestFrameworkMethod = {
  readonly framework: TestFramework;
  readonly method: string;
};

const moduleMockMethods = new Set(["doMock", "mock", "unstable_mockModule"]);

const spyOptionMethods = new Set(["doMock", "mock", "mockObject"]);

function importedName(node: ESTree.Node) {
  if (node.type !== "ImportSpecifier") {
    return null;
  }

  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}

function frameworkName(name: string) {
  return name === "vi" || name === "jest" ? name : null;
}

export function testFrameworkObject(
  sourceCode: SourceCode,
  expression: ESTree.Node,
): TestFramework | null {
  const value = unwrapExpression(expression);
  const globalName = value.type === "Identifier" ? frameworkName(value.name) : null;

  if (globalName !== null && isGlobal(sourceCode, value, globalName)) {
    return globalName;
  }

  const binding = importedBinding(sourceCode, value);

  if (binding !== null && vitestModules.includes(binding.source) && binding.name === "vi") {
    return "vi";
  }

  return binding?.source === "@jest/globals" && binding.name === "jest" ? "jest" : null;
}

function destructuredKey(pattern: ESTree.ObjectPattern, name: ESTree.Node) {
  const property = pattern.properties.find(
    (candidate) =>
      candidate.type === "Property" &&
      (candidate.value === name ||
        (candidate.value.type === "AssignmentPattern" && candidate.value.left === name)),
  );

  return property ? staticPropertyName(property) : null;
}

export function testFrameworkMethod(
  sourceCode: SourceCode,
  callee: ESTree.Node,
): TestFrameworkMethod | null {
  const value = unwrapExpression(callee);

  if (value.type === "MemberExpression") {
    const framework = testFrameworkObject(sourceCode, value.object);
    const method = staticPropertyName(value);

    return framework === null || method === null ? null : { framework, method };
  }

  const variable = variableFor(sourceCode, value);
  const [definition, ...otherDefinitions] = variable?.defs ?? [];
  const declarator = definition?.node;

  if (
    otherDefinitions.length > 0 ||
    definition?.type !== "Variable" ||
    definition.parent?.type !== "VariableDeclaration" ||
    definition.parent.kind !== "const" ||
    declarator?.type !== "VariableDeclarator" ||
    declarator.init === null
  ) {
    return null;
  }

  if (declarator.id.type === "Identifier") {
    return unwrapExpression(declarator.init).type === "MemberExpression"
      ? testFrameworkMethod(sourceCode, declarator.init)
      : null;
  }

  const framework = testFrameworkObject(sourceCode, declarator.init);

  const method =
    declarator.id.type === "ObjectPattern" ? destructuredKey(declarator.id, definition.name) : null;

  return framework === null || method === null ? null : { framework, method };
}

function hasSpyOption(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const options = call.arguments[1];

  if (options === undefined || options.type === "SpreadElement") {
    return false;
  }

  const spy = resolveProperty(sourceCode, options, "spy");
  const flag = spy.kind === "known" ? unwrapExpression(spy.value) : null;

  return flag?.type === "Literal" && flag.value === true;
}

export function isSpyOnlyCall(
  sourceCode: SourceCode,
  call: ESTree.CallExpression,
  api: TestFrameworkMethod,
): boolean {
  return (
    api.framework === "vi" && spyOptionMethods.has(api.method) && hasSpyOption(sourceCode, call)
  );
}

const nodeTestModules = ["node:test", "test"];

const nodeTestContextMethods = new Set(["test", "before", "after", "beforeEach", "afterEach"]);

function callbackCalls(sourceCode: SourceCode, callback: FunctionNode) {
  return functionUses(sourceCode, callback).flatMap((use) =>
    use.parent?.type === "CallExpression" && use.parent.arguments.some((item) => item === use)
      ? [use.parent]
      : [],
  );
}

const isNodeTestContext: (
  sourceCode: SourceCode,
  node: ESTree.IdentifierReference,
  visited: Set<ESTree.Node>,
) => boolean = (sourceCode, node, visited) => {
  const definition = variableFor(sourceCode, node)?.defs[0];
  const callback = definition?.type === "Parameter" ? definition.node : null;

  if (
    callback === null ||
    !isFunctionNode(callback) ||
    callback.params[0] !== definition?.name ||
    visited.has(callback)
  ) {
    return false;
  }

  visited.add(callback);

  return callbackCalls(sourceCode, callback).some(
    ({ callee }) =>
      nodeTestModules.includes(apiReference(sourceCode, callee)?.module ?? "") ||
      (callee.type === "MemberExpression" &&
        callee.object.type === "Identifier" &&
        nodeTestContextMethods.has(propertyName(callee) ?? "") &&
        isNodeTestContext(sourceCode, callee.object, visited)),
  );
};

export function isNodeTestMock(sourceCode: SourceCode, expression: ESTree.Expression): boolean {
  if (expression.type === "MemberExpression") {
    return (
      !expression.computed &&
      expression.property.type === "Identifier" &&
      expression.property.name === "mock" &&
      expression.object.type === "Identifier" &&
      isNodeTestContext(sourceCode, expression.object, new Set())
    );
  }

  if (expression.type !== "Identifier") {
    return false;
  }

  return (
    variableFor(sourceCode, expression)?.defs.some(
      (definition) =>
        definition.type === "ImportBinding" &&
        definition.parent?.type === "ImportDeclaration" &&
        nodeTestModules.includes(definition.parent.source.value) &&
        importedName(definition.node) === "mock",
    ) ?? false
  );
}

export function isModuleMockCall(sourceCode: SourceCode, call: ESTree.CallExpression): boolean {
  const callee = call.callee;

  if (
    callee.type === "MemberExpression" &&
    propertyName(callee) === "module" &&
    isNodeTestMock(sourceCode, callee.object)
  ) {
    return true;
  }

  const api = testFrameworkMethod(sourceCode, callee);

  return api !== null && moduleMockMethods.has(api.method) && !isSpyOnlyCall(sourceCode, call, api);
}
