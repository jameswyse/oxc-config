import { matchesGlob, relative, sep } from "node:path";

import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

export type ApiReference = {
  readonly module: string;
  readonly name: string;
};

export type TestContext = {
  readonly callback: FunctionNode;
  readonly api: ApiReference;
};

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

type VisitorKeys = SourceCode["visitorKeys"];

export const testModules = new Set([
  "vitest",
  "@effect/vitest",
  "@jest/globals",
  "@playwright/test",
  "playwright/test",
  "node:test",
]);

const defaultImports = new Map<string, string>([
  ["@playwright/test", "test"],
  ["playwright/test", "test"],
  ["node:test", "test"],
  ["node:timers/promises", "*"],
  ["timers/promises", "*"],
]);

export const testFunctions = new Set([
  "test",
  "it",
  "beforeEach",
  "afterEach",
  "beforeAll",
  "afterAll",
]);

const testModifiers = new Set([
  "only",
  "skip",
  "todo",
  "concurrent",
  "sequential",
  "serial",
  "fails",
]);

const testFactories = new Set(["each", "for", "runIf", "skipIf"]);

const effectModifiers = new Set(["effect", "live", "scoped"]);

export function isNode(value: unknown): value is ESTree.Node {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

export function childNodes(node: ESTree.Node, visitorKeys: VisitorKeys): ESTree.Node[] {
  const children: ESTree.Node[] = [];

  for (const key of visitorKeys[node.type] ?? []) {
    const value: unknown = Object.getOwnPropertyDescriptor(node, key)?.value;
    const items: readonly unknown[] = Array.isArray(value) ? value : [value];

    for (const item of items) {
      if (isNode(item)) {
        children.push(item);
      }
    }
  }

  return children;
}

export function variableFor(sourceCode: SourceCode, node: ESTree.Node): Variable | null {
  if (
    node.type !== "Identifier" &&
    node.type !== "PrivateIdentifier" &&
    node.type !== "JSXIdentifier"
  ) {
    return null;
  }

  let scope: Scope | null = sourceCode.getScope(node);

  while (scope !== null) {
    const variable = scope.set.get(node.name);

    if (variable !== undefined) {
      return variable;
    }

    scope = scope.upper;
  }

  return null;
}

export function isGlobal(
  sourceCode: SourceCode,
  identifier: ESTree.Node | null | undefined,
  name: string,
): boolean {
  return (
    identifier?.type === "Identifier" &&
    identifier.name === name &&
    !variableFor(sourceCode, identifier)?.defs.length
  );
}

function memberKey(node: ESTree.Node): ESTree.Node | null {
  if ("property" in node) {
    return node.property;
  }

  return "key" in node ? node.key : null;
}

export function propertyName(node: ESTree.Node): string | null {
  if ("computed" in node && node.computed) {
    return null;
  }

  const key = memberKey(node);

  if (key?.type === "Identifier" || key?.type === "PrivateIdentifier") {
    return key.name;
  }

  return key?.type === "Literal" && typeof key.value === "string" ? key.value : null;
}

export function isPlaywright(module: string): boolean {
  return module === "@playwright/test" || module === "playwright/test";
}

export function apiReference(
  sourceCode: SourceCode,
  node: ESTree.Node,
  seen = new Set<Variable>(),
): ApiReference | null {
  if (node.type === "Identifier") {
    const variable = variableFor(sourceCode, node);

    if (!variable?.defs.length) {
      return testFunctions.has(node.name) || node.name === "expect"
        ? { module: "global", name: node.name }
        : null;
    }

    const [definition] = variable.defs;

    if (seen.has(variable) || definition === undefined || variable.defs.length !== 1) {
      return null;
    }

    seen.add(variable);
    const specifier = definition.node;
    const declaration = definition.parent;

    if (definition.type === "ImportBinding" && declaration?.type === "ImportDeclaration") {
      const module = declaration.source.value;

      if (
        specifier.type === "ImportDefaultSpecifier" ||
        (specifier.type === "ImportSpecifier" &&
          specifier.imported.type === "Identifier" &&
          specifier.imported.name === "default")
      ) {
        const name = defaultImports.get(module);

        return name ? { module, name } : null;
      }

      if (specifier.type === "ImportNamespaceSpecifier") {
        return { module, name: "*" };
      }

      if (specifier.type === "ImportSpecifier") {
        return {
          module,
          name:
            specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value,
        };
      }

      return null;
    }

    if (
      definition.type === "Variable" &&
      declaration?.type === "VariableDeclaration" &&
      declaration.kind === "const" &&
      specifier.type === "VariableDeclarator" &&
      specifier.id.type === "Identifier" &&
      specifier.init
    ) {
      return apiReference(sourceCode, specifier.init, seen);
    }

    return null;
  }

  if (node.type === "MemberExpression") {
    const object = apiReference(sourceCode, node.object, seen);
    const name = propertyName(node);

    if (!object || !name) {
      return null;
    }

    if (object.name === "*") {
      return { module: object.module, name };
    }

    if (testFunctions.has(object.name) && (testModifiers.has(name) || testFactories.has(name))) {
      return object;
    }

    if (
      object.module === "@effect/vitest" &&
      ["test", "it"].includes(object.name) &&
      effectModifiers.has(name)
    ) {
      return object;
    }

    if (object.name === "test" && testFunctions.has(name)) {
      return { module: object.module, name };
    }

    return null;
  }

  if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
    const name = propertyName(node.callee);
    const object = apiReference(sourceCode, node.callee.object, seen);

    if (object && name !== null && testFunctions.has(object.name) && testFactories.has(name)) {
      return object;
    }

    if (
      object &&
      ["test", "it"].includes(object.name) &&
      (isPlaywright(object.module) || ["vitest", "@effect/vitest"].includes(object.module)) &&
      name === "extend"
    ) {
      return object;
    }
  }

  if (
    node.type === "TaggedTemplateExpression" &&
    node.tag.type === "MemberExpression" &&
    propertyName(node.tag) === "each"
  ) {
    return apiReference(sourceCode, node.tag.object, seen);
  }

  return null;
}

export function testContext(sourceCode: SourceCode, node: ESTree.Node): TestContext | null {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type !== "ArrowFunctionExpression" && ancestor.type !== "FunctionExpression") {
      continue;
    }

    const call = ancestor.parent;

    if (call.type !== "CallExpression" || !call.arguments.includes(ancestor)) {
      continue;
    }

    const api = apiReference(sourceCode, call.callee);

    if (
      api &&
      testFunctions.has(api.name) &&
      (testModules.has(api.module) || api.module === "global")
    ) {
      return { callback: ancestor, api };
    }
  }

  return null;
}

export function projectPath(cwd: string, file: string): string {
  return relative(cwd, file).split(sep).join("/");
}

export function matchesAny(path: string, patterns: readonly string[] = []): boolean {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}

const globalObjects = ["globalThis", "global", "window", "self"];

function isFunctionNode(node: ESTree.Node): node is FunctionNode {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  );
}

export function isGlobalValue(
  sourceCode: SourceCode,
  node: ESTree.Node | null | undefined,
  name: string,
): boolean {
  if (isGlobal(sourceCode, node, name)) {
    return true;
  }

  return (
    node?.type === "MemberExpression" &&
    propertyName(node) === name &&
    globalObjects.some((object) => isGlobal(sourceCode, node.object, object))
  );
}

function returns(callback: FunctionNode, value: ESTree.Node): boolean {
  const body = callback.body;

  if (body === value) {
    return true;
  }

  if (body?.type !== "BlockStatement") {
    return false;
  }

  const [statement] = body.body;

  return (
    body.body.length === 1 && statement?.type === "ReturnStatement" && statement.argument === value
  );
}

function isProvider(callback: FunctionNode, value: ESTree.Node): boolean {
  const holder = callback.parent;

  if (holder.type === "AssignmentPattern") {
    return holder.right === callback;
  }

  if (!returns(callback, value)) {
    return false;
  }

  return (
    (holder.type === "Property" && holder.value === callback) ||
    (holder.type === "LogicalExpression" &&
      holder.right === callback &&
      ["??", "||"].includes(holder.operator))
  );
}

export function isInjectionSeam(source: ESTree.Node): boolean {
  const parent = source.parent;

  if (source.type !== "NewExpression" && source.type !== "CallExpression") {
    return parent?.type === "CallExpression" && parent.callee === source
      ? isInjectionSeam(parent)
      : true;
  }

  let child: ESTree.Node = source;

  for (let ancestor = parent; ancestor; child = ancestor, ancestor = ancestor.parent) {
    if (ancestor.type === "AssignmentPattern") {
      return ancestor.right === child;
    }

    if (isFunctionNode(ancestor)) {
      return isProvider(ancestor, source);
    }
  }

  return false;
}
