import { matchesGlob, relative, sep } from "node:path";

import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

export type ApiReference = {
  readonly module: string;
  readonly name: string;
};

export type ImportedBinding = {
  readonly source: string;
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

export function staticString(node: ESTree.Node | null | undefined): string | null {
  if (node?.type === "TemplateLiteral") {
    const [quasi] = node.quasis;

    return node.expressions.length === 0 && quasi ? (quasi.value.cooked ?? null) : null;
  }

  return node?.type === "Literal" && typeof node.value === "string" ? node.value : null;
}

export function staticPropertyName(node: ESTree.Node): string | null {
  return "computed" in node && node.computed ? staticString(memberKey(node)) : propertyName(node);
}

export function moduleExportName(node: ESTree.ModuleExportName): string {
  return node.type === "Identifier" ? node.name : node.value;
}

export function unwrapExpression(node: ESTree.Node): ESTree.Node {
  return node.type === "ParenthesizedExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSTypeAssertion"
    ? unwrapExpression(node.expression)
    : node;
}

function dynamicImportSource(node: ESTree.Node): string | null {
  const awaited = unwrapExpression(node);
  const loaded = awaited.type === "AwaitExpression" ? unwrapExpression(awaited.argument) : null;

  if (loaded?.type !== "ImportExpression") {
    return null;
  }

  return staticString(loaded.source);
}

type Definition = Variable["defs"][number];

type ConstAlias = {
  readonly init: ESTree.Expression;
  readonly pattern: ESTree.VariableDeclarator["id"];
  readonly name: string;
};

const bindingCache = new WeakMap<Variable, ImportedBinding | null>();

const referenceCache = new WeakMap<Variable, ApiReference | null>();

function memberBinding(owner: ImportedBinding | null, name: string | null): ImportedBinding | null {
  return (owner?.name === "*" || owner?.name === "default") && name !== null
    ? { source: owner.source, name }
    : null;
}

function bindsName(property: ESTree.ObjectPattern["properties"][number], name: string): boolean {
  if (property.type !== "Property") {
    return false;
  }

  const target = property.value.type === "AssignmentPattern" ? property.value.left : property.value;

  return target.type === "Identifier" && target.name === name;
}

function constAlias(definition: Definition): ConstAlias | null {
  const declaration = definition.parent;
  const declarator = definition.node;

  return definition.type === "Variable" &&
    declaration?.type === "VariableDeclaration" &&
    declaration.kind === "const" &&
    declarator.type === "VariableDeclarator" &&
    declarator.init
    ? { init: declarator.init, pattern: declarator.id, name: definition.name.name }
    : null;
}

function destructuredName(pattern: ConstAlias["pattern"], name: string): string | null {
  const property =
    pattern.type === "ObjectPattern"
      ? pattern.properties.find((candidate) => bindsName(candidate, name))
      : undefined;

  return property ? staticPropertyName(property) : null;
}

function aliasTarget<T>(
  alias: ConstAlias,
  resolve: (node: ESTree.Node) => T | null,
  member: (owner: T, name: string) => T | null,
): T | null {
  const initial = resolve(alias.init);

  if (alias.pattern.type === "Identifier") {
    return initial;
  }

  const name = destructuredName(alias.pattern, alias.name);

  return initial !== null && name !== null ? member(initial, name) : null;
}

function cached<T>(
  cache: WeakMap<Variable, T | null>,
  variable: Variable,
  resolve: () => T | null,
): T | null {
  if (!cache.has(variable)) {
    cache.set(variable, null);
    cache.set(variable, resolve());
  }

  return cache.get(variable) ?? null;
}

function importBinding(definition: Definition): ImportedBinding | null {
  const declaration = definition.parent;
  const specifier = definition.node;

  if (definition.type !== "ImportBinding" || declaration?.type !== "ImportDeclaration") {
    return null;
  }

  const source = declaration.source.value;

  if (specifier.type === "ImportNamespaceSpecifier") {
    return { source, name: "*" };
  }

  if (specifier.type === "ImportDefaultSpecifier") {
    return { source, name: "default" };
  }

  return specifier.type === "ImportSpecifier"
    ? {
        source,
        name: moduleExportName(specifier.imported),
      }
    : null;
}

export function importedBinding(sourceCode: SourceCode, node: ESTree.Node): ImportedBinding | null {
  const value = unwrapExpression(node);
  const dynamicSource = dynamicImportSource(value);

  if (dynamicSource !== null) {
    return { source: dynamicSource, name: "*" };
  }

  if (value.type === "MemberExpression") {
    return memberBinding(importedBinding(sourceCode, value.object), staticPropertyName(value));
  }

  const variable = variableFor(sourceCode, value);
  const definition = variable?.defs[0];

  if (variable === null || definition === undefined) {
    return null;
  }

  return cached(bindingCache, variable, () => {
    const alias = constAlias(definition);

    return alias === null
      ? importBinding(definition)
      : aliasTarget(alias, (init) => importedBinding(sourceCode, init), memberBinding);
  });
}

function bindingReference(binding: ImportedBinding): ApiReference | null {
  const defaultExport = defaultImports.get(binding.source);

  if (binding.name === "default") {
    return defaultExport ? { module: binding.source, name: defaultExport } : null;
  }

  return defaultExport !== undefined &&
    testFunctions.has(defaultExport) &&
    testModifiers.has(binding.name)
    ? { module: binding.source, name: defaultExport }
    : { module: binding.source, name: binding.name };
}

function memberReference(object: ApiReference, name: string): ApiReference | null {
  if (object.name === "*") {
    return bindingReference({ source: object.module, name });
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

  return object.name === "test" && testFunctions.has(name) ? { module: object.module, name } : null;
}

export function apiReference(sourceCode: SourceCode, node: ESTree.Node): ApiReference | null {
  const value = unwrapExpression(node);

  if (value.type === "Identifier") {
    const variable = variableFor(sourceCode, value);

    if (!variable?.defs.length) {
      return testFunctions.has(value.name) || value.name === "expect"
        ? { module: "global", name: value.name }
        : null;
    }

    const [definition] = variable.defs;

    if (definition === undefined || variable.defs.length !== 1) {
      return null;
    }

    return cached(referenceCache, variable, () => {
      const alias = constAlias(definition);

      if (alias !== null) {
        return aliasTarget(alias, (init) => apiReference(sourceCode, init), memberReference);
      }

      const binding = importBinding(definition);

      return binding && bindingReference(binding);
    });
  }

  if (value.type === "MemberExpression") {
    const object = apiReference(sourceCode, value.object);
    const name = staticPropertyName(value);

    return object && name !== null ? memberReference(object, name) : null;
  }

  if (value.type === "CallExpression") {
    const callee = unwrapExpression(value.callee);

    if (callee.type !== "MemberExpression") {
      return null;
    }

    const name = staticPropertyName(callee);
    const object = apiReference(sourceCode, callee.object);

    if (object && name !== null && testFunctions.has(object.name) && testFactories.has(name)) {
      return object;
    }

    return object &&
      ["test", "it"].includes(object.name) &&
      (isPlaywright(object.module) || ["vitest", "@effect/vitest"].includes(object.module)) &&
      name === "extend"
      ? object
      : null;
  }

  if (value.type === "TaggedTemplateExpression") {
    const tag = unwrapExpression(value.tag);

    return tag.type === "MemberExpression" && staticPropertyName(tag) === "each"
      ? apiReference(sourceCode, tag.object)
      : null;
  }

  const dynamicSource = dynamicImportSource(value);

  return dynamicSource === null ? null : { module: dynamicSource, name: "*" };
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

const nodeGlobalObjects = ["globalThis", "global"];

const globalObjects = [...nodeGlobalObjects, "window", "self"];

function isFunctionNode(node: ESTree.Node): node is FunctionNode {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionExpression" ||
    node.type === "FunctionDeclaration"
  );
}

function isGlobalThrough(
  sourceCode: SourceCode,
  node: ESTree.Node | null | undefined,
  name: string,
  objects: readonly string[],
): boolean {
  const value = node ? unwrapExpression(node) : null;

  if (isGlobal(sourceCode, value, name)) {
    return true;
  }

  return (
    value?.type === "MemberExpression" &&
    staticPropertyName(value) === name &&
    objects.some((object) => isGlobal(sourceCode, unwrapExpression(value.object), object))
  );
}

export function isGlobalValue(
  sourceCode: SourceCode,
  node: ESTree.Node | null | undefined,
  name: string,
): boolean {
  return isGlobalThrough(sourceCode, node, name, globalObjects);
}

export function isNodeGlobalValue(
  sourceCode: SourceCode,
  node: ESTree.Node | null | undefined,
  name: string,
): boolean {
  return isGlobalThrough(sourceCode, node, name, nodeGlobalObjects);
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

export function isShortCircuited(call: ESTree.CallExpression): boolean {
  let current: ESTree.Node = call;

  while (current.type === "CallExpression" || current.type === "MemberExpression") {
    if (current.optional) {
      return true;
    }

    current = current.type === "CallExpression" ? current.callee : current.object;

    while (current.type === "TSNonNullExpression") {
      current = current.expression;
    }
  }

  return false;
}

export function isEffectModule(sourceCode: SourceCode, node: ESTree.Node, module: string): boolean {
  const binding = importedBinding(sourceCode, node);

  return (
    (binding?.source === "effect" && binding.name === module) ||
    (binding?.source === `effect/${module}` && binding.name === "*")
  );
}

export function outermostExpression(node: ESTree.Node): ESTree.Node {
  const parent = node.parent;

  return parent !== null && unwrapExpression(parent) === unwrapExpression(node)
    ? outermostExpression(parent)
    : node;
}
