import { matchesGlob, relative, sep } from "node:path";

import type { ESTree, Reference, Scope, SourceCode, Variable } from "@oxlint/plugins";

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

export type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

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

const referencesByScope = new WeakMap<Scope, Map<ESTree.Node, Reference>>();

function scopeReference(scope: Scope, node: ESTree.Node): Reference | undefined {
  let references = referencesByScope.get(scope);

  if (references === undefined) {
    references = new Map(scope.references.map((reference) => [reference.identifier, reference]));
    referencesByScope.set(scope, references);
  }

  return references.get(node);
}

export function variableFor(sourceCode: SourceCode, node: ESTree.Node): Variable | null {
  if (
    node.type !== "Identifier" &&
    node.type !== "PrivateIdentifier" &&
    node.type !== "JSXIdentifier"
  ) {
    return null;
  }

  const innermost = sourceCode.getScope(node);

  for (let scope: Scope | null = innermost; scope !== null; scope = scope.upper) {
    const reference = scopeReference(scope, node);

    if (reference !== undefined) {
      return reference.resolved;
    }
  }

  for (let scope: Scope | null = innermost; scope !== null; scope = scope.upper) {
    const variable = scope.set.get(node.name);

    if (variable !== undefined) {
      return variable;
    }
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

export function unwrapExpression(node: ESTree.Node): ESTree.Node {
  return node.type === "ParenthesizedExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSTypeAssertion"
    ? unwrapExpression(node.expression)
    : node;
}

export function outermostExpression(node: ESTree.Node): ESTree.Node {
  const parent = node.parent;

  return parent !== null && unwrapExpression(parent) === unwrapExpression(node)
    ? outermostExpression(parent)
    : node;
}

export function staticString(node: ESTree.Node | null | undefined): string | null {
  const value = node ? unwrapExpression(node) : null;

  if (value?.type === "TemplateLiteral") {
    const [quasi] = value.quasis;

    return value.expressions.length === 0 && quasi ? (quasi.value.cooked ?? null) : null;
  }

  return value?.type === "Literal" && typeof value.value === "string" ? value.value : null;
}

export function staticPropertyName(node: ESTree.Node): string | null {
  return "computed" in node && node.computed ? staticString(memberKey(node)) : propertyName(node);
}

export function moduleExportName(node: ESTree.ModuleExportName): string {
  return node.type === "Identifier" ? node.name : node.value;
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

function destructuredPath(pattern: ESTree.Node, name: string): string[] | null {
  if (pattern.type !== "ObjectPattern") {
    return null;
  }

  for (const property of pattern.properties) {
    const key = property.type === "Property" ? staticPropertyName(property) : null;

    if (property.type !== "Property" || key === null) {
      continue;
    }

    const target =
      property.value.type === "AssignmentPattern" ? property.value.left : property.value;

    if (target.type === "Identifier" && target.name === name) {
      return [key];
    }

    const path = destructuredPath(target, name);

    if (path !== null) {
      return [key, ...path];
    }
  }

  return null;
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

  const path = destructuredPath(alias.pattern, alias.name);

  return path === null
    ? null
    : path.reduce<T | null>(
        (owner, name) => (owner === null ? null : member(owner, name)),
        initial,
      );
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

const nodeModuleSources = new Set(["module", "node:module"]);

const loaderCache = new WeakMap<Variable, boolean | null>();

type BindingResolver = (node: ESTree.Node) => ImportedBinding | null;

export function unchangedInit(variable: Variable): ESTree.Expression | null {
  const [definition, ...otherDefinitions] = variable.defs;
  const declarator = definition?.node;

  return otherDefinitions.length === 0 &&
    definition?.type === "Variable" &&
    declarator?.type === "VariableDeclarator" &&
    declarator.id === definition.name &&
    variable.references.every((reference) => reference.init || !reference.isWrite())
    ? declarator.init
    : null;
}

type StringPiece =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "value"; readonly node: ESTree.Node }
  | { readonly kind: "unknown" };

function isStringRaw(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const tag = unwrapExpression(node);

  return (
    tag.type === "MemberExpression" &&
    staticPropertyName(tag) === "raw" &&
    isGlobal(sourceCode, unwrapExpression(tag.object), "String")
  );
}

const maxStringPieces = 512;

const maxStringLength = 65_536;

const stringPieceCache = new WeakMap<Variable, StringPiece[] | null>();

function joined(pieces: readonly StringPiece[]): StringPiece[] {
  const result: StringPiece[] = [];

  for (const piece of pieces) {
    const last = result.at(-1);

    if (piece.kind === "text" && last?.kind === "text") {
      result[result.length - 1] = { kind: "text", text: last.text + piece.text };
    } else {
      result.push(piece);
    }
  }

  const length = result.reduce(
    (total, piece) => total + (piece.kind === "text" ? piece.text.length : 0),
    0,
  );

  return result.length > maxStringPieces || length > maxStringLength
    ? [{ kind: "unknown" }]
    : result;
}

function stringPieces(sourceCode: SourceCode, node: ESTree.Node): StringPiece[] {
  const value = unwrapExpression(node);

  function template(literal: ESTree.TemplateLiteral, mode: "raw" | "cooked"): StringPiece[] {
    return literal.quasis.flatMap((quasi, index) => {
      const text = mode === "raw" ? quasi.value.raw : (quasi.value.cooked ?? quasi.value.raw);
      const expression = literal.expressions[index];

      return [
        { kind: "text", text } as const,
        ...(expression === undefined ? [] : stringPieces(sourceCode, expression)),
      ];
    });
  }

  if (value.type === "Literal") {
    return [{ kind: "text", text: String(value.value) }];
  }

  if (value.type === "TemplateLiteral") {
    return joined(template(value, "cooked"));
  }

  if (value.type === "TaggedTemplateExpression" && isStringRaw(sourceCode, value.tag)) {
    return joined(template(value.quasi, "raw"));
  }

  if (value.type === "BinaryExpression" && value.operator === "+") {
    return joined([value.left, value.right].flatMap((part) => stringPieces(sourceCode, part)));
  }

  const variable = variableFor(sourceCode, value);
  const init = variable === null ? null : unchangedInit(variable);

  const pieces =
    variable === null || init === null
      ? null
      : cached(stringPieceCache, variable, () => stringPieces(sourceCode, init));

  return pieces ?? [{ kind: "value", node: value }];
}

export function dynamicParts(sourceCode: SourceCode, node: ESTree.Node): ESTree.Node[] {
  return stringPieces(sourceCode, node).flatMap((piece) =>
    piece.kind === "value" ? [piece.node] : [],
  );
}

export function constantString(sourceCode: SourceCode, node: ESTree.Node): string | null {
  const pieces = stringPieces(sourceCode, node);

  return pieces.every((piece) => piece.kind === "text")
    ? pieces.map((piece) => piece.text).join("")
    : null;
}

function isRequireFactory(node: ESTree.Node, resolve: BindingResolver): boolean {
  const binding = node.type === "CallExpression" ? resolve(node.callee) : null;

  return (
    binding !== null && nodeModuleSources.has(binding.source) && binding.name === "createRequire"
  );
}

function isLoader(sourceCode: SourceCode, node: ESTree.Node, resolve: BindingResolver): boolean {
  const callee = unwrapExpression(node);

  if (isGlobal(sourceCode, callee, "require") || isRequireFactory(callee, resolve)) {
    return true;
  }

  const variable = variableFor(sourceCode, callee);

  return (
    variable !== null &&
    cached(loaderCache, variable, () => {
      const init = unchangedInit(variable);

      return init !== null && isLoader(sourceCode, init, resolve);
    }) === true
  );
}

function loadedSource(
  sourceCode: SourceCode,
  node: ESTree.Node,
  resolve: BindingResolver,
): string | null {
  const required =
    node.type === "CallExpression" &&
    node.arguments.length === 1 &&
    isLoader(sourceCode, node.callee, resolve);

  return required ? staticString(node.arguments[0]) : dynamicImportSource(node);
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
  const source = loadedSource(sourceCode, value, (callee) => importedBinding(sourceCode, callee));

  if (source !== null) {
    return { source, name: "*" };
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

export function isRequire(sourceCode: SourceCode, node: ESTree.Node): boolean {
  return isLoader(sourceCode, node, (callee) => importedBinding(sourceCode, callee));
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
  const source = loadedSource(sourceCode, value, (callee) => importedBinding(sourceCode, callee));

  if (source !== null) {
    return { module: source, name: "*" };
  }

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

const nodeGlobalObjects = ["globalThis", "global"];

const globalObjects = [...nodeGlobalObjects, "window", "self"];

export function isFunctionNode(node: ESTree.Node): node is FunctionNode {
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

  if (body?.type !== "BlockStatement") {
    return body !== null && unwrapExpression(body) === value;
  }

  const [statement] = body.body;

  return (
    body.body.length === 1 &&
    statement?.type === "ReturnStatement" &&
    statement.argument !== null &&
    unwrapExpression(statement.argument) === value
  );
}

function isProvider(callback: FunctionNode, value: ESTree.Node): boolean {
  const provider = outermostExpression(callback);
  const holder = provider.parent;

  if (holder?.type === "AssignmentPattern") {
    return holder.right === provider;
  }

  if (!returns(callback, value)) {
    return false;
  }

  return (
    (holder?.type === "Property" && holder.value === provider) ||
    (holder?.type === "LogicalExpression" &&
      holder.right === provider &&
      ["??", "||"].includes(holder.operator))
  );
}

export function isInjectedValue(source: ESTree.Node): boolean {
  let child: ESTree.Node = source;

  for (let ancestor = source.parent; ancestor; child = ancestor, ancestor = ancestor.parent) {
    if (ancestor.type === "AssignmentPattern") {
      return ancestor.right === child;
    }

    if (isFunctionNode(ancestor)) {
      return isProvider(ancestor, source);
    }
  }

  return false;
}

export function isInjectionSeam(source: ESTree.Node): boolean {
  if (source.type !== "NewExpression" && source.type !== "CallExpression") {
    const callee = outermostExpression(source);
    const call = callee.parent;

    return call?.type === "CallExpression" && call.callee === callee ? isInjectionSeam(call) : true;
  }

  return isInjectedValue(source);
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

export function effectMember(
  sourceCode: SourceCode,
  node: ESTree.Node,
  module: string,
): string | null {
  const value = unwrapExpression(node);

  return value.type === "MemberExpression" && isEffectModule(sourceCode, value.object, module)
    ? staticPropertyName(value)
    : null;
}

export function ownReturns(fn: FunctionNode, visitorKeys: VisitorKeys): ESTree.Node[] {
  if (fn.body === null) {
    return [];
  }

  if (fn.body.type !== "BlockStatement") {
    return [fn.body];
  }

  const returned: ESTree.Node[] = [];

  const visit = (node: ESTree.Node): void => {
    if (node.type === "ReturnStatement") {
      if (node.argument !== null) {
        returned.push(node.argument);
      }

      return;
    }

    if (!isFunctionNode(node)) {
      childNodes(node, visitorKeys).forEach(visit);
    }
  };

  visit(fn.body);

  return returned;
}

export type PipeSteps = {
  readonly input: ESTree.Node | null;
  readonly steps: ESTree.Node[];
};

export function pipeSteps(sourceCode: SourceCode, call: ESTree.CallExpression): PipeSteps | null {
  const callee = unwrapExpression(call.callee);
  const values = call.arguments.filter((argument) => argument.type !== "SpreadElement");

  if (callee.type === "MemberExpression" && propertyName(callee) === "pipe") {
    return { input: callee.object, steps: values };
  }

  const binding = importedBinding(sourceCode, callee);

  if (binding === null || !["effect", "effect/Function"].includes(binding.source)) {
    return null;
  }

  if (binding.name === "pipe") {
    return { input: values[0] ?? null, steps: values.slice(1) };
  }

  return binding.name === "flow" ? { input: null, steps: values } : null;
}
