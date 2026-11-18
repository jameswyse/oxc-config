import {
  constantString,
  isFunctionNode,
  isGlobal,
  propertyName,
  staticPropertyName,
  unchangedInit,
  unwrapExpression,
  variableFor,
} from "./index.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

export type ResolvedProperty =
  | { readonly kind: "known"; readonly value: ESTree.Node }
  | { readonly kind: "undefined" }
  | { readonly kind: "missing" }
  | { readonly kind: "unknown" };

type Lookup = ResolvedProperty | { readonly kind: "absent" };

type Truthiness = "truthy" | "falsy" | "nullish" | "unknown";

const absent: Lookup = { kind: "absent" };

const explicitUndefined: Lookup = { kind: "undefined" };

const unknown: Lookup = { kind: "unknown" };

const mutatingCalls = {
  Object: new Set(["assign", "defineProperty", "defineProperties"]),
  Reflect: new Set(["set", "defineProperty"]),
};

export function isNullishValue(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const value = unwrapExpression(node);

  return (
    (value.type === "Literal" && value.raw === "null") ||
    (value.type === "UnaryExpression" && value.operator === "void") ||
    isGlobal(sourceCode, value, "undefined")
  );
}

function truthiness(sourceCode: SourceCode, node: ESTree.Node) {
  if (isNullishValue(sourceCode, node)) {
    return "nullish";
  }

  if (node.type === "Literal") {
    return node.value ? "truthy" : "falsy";
  }

  return node.type === "ObjectExpression" ||
    node.type === "ArrayExpression" ||
    node.type === "ClassExpression" ||
    node.type === "NewExpression" ||
    isFunctionNode(node)
    ? "truthy"
    : "unknown";
}

function logicalResult(operator: ESTree.LogicalExpression["operator"], left: Truthiness) {
  if (left === "unknown") {
    return "both";
  }

  if (operator === "??") {
    return left === "nullish" ? "right" : "left";
  }

  const leftIsFalsy = left !== "truthy";

  return leftIsFalsy === (operator === "||") ? "right" : "left";
}

function isMutatingCallTarget(sourceCode: SourceCode, node: ESTree.Node) {
  const call = node.parent;

  if (call?.type !== "CallExpression" || call.arguments[0] !== node) {
    return false;
  }

  const callee = unwrapExpression(call.callee);

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const owner = unwrapExpression(callee.object);
  const method = staticPropertyName(callee);

  return Object.entries(mutatingCalls).some(
    ([global, methods]) => methods.has(method ?? "") && isGlobal(sourceCode, owner, global),
  );
}

function isWrittenMember(member: ESTree.Node) {
  const parent = member.parent;

  return (
    (parent?.type === "AssignmentExpression" && parent.left === member) ||
    (parent?.type === "UpdateExpression" && parent.argument === member) ||
    (parent?.type === "UnaryExpression" && parent.operator === "delete")
  );
}

const isMutatedThrough: (sourceCode: SourceCode, node: ESTree.Node) => boolean = (
  sourceCode,
  node,
) => {
  const parent = node.parent;

  if (isMutatingCallTarget(sourceCode, node)) {
    return true;
  }

  if (parent !== null && unwrapExpression(parent) === unwrapExpression(node)) {
    return isMutatedThrough(sourceCode, parent);
  }

  return (
    parent?.type === "MemberExpression" &&
    parent.object === node &&
    (isWrittenMember(parent) || isMutatedThrough(sourceCode, parent))
  );
};

function followedInit(sourceCode: SourceCode, variable: Variable) {
  const init = unchangedInit(variable);

  return init !== null &&
    !variable.references.some((reference) => isMutatedThrough(sourceCode, reference.identifier))
    ? init
    : null;
}

const branches: (
  sourceCode: SourceCode,
  node: ESTree.Node,
  visited: ReadonlySet<Variable>,
) => ESTree.Node[] = (sourceCode, node, visited) => {
  const value = unwrapExpression(node);

  if (value.type === "ConditionalExpression") {
    return [value.consequent, value.alternate].flatMap((branch) =>
      branches(sourceCode, branch, visited),
    );
  }

  if (value.type === "LogicalExpression") {
    const right = branches(sourceCode, value.right, visited);

    return branches(sourceCode, value.left, visited).flatMap((left) => {
      const selected = logicalResult(value.operator, truthiness(sourceCode, left));

      if (selected === "both") {
        return [left, ...right];
      }

      return selected === "right" ? right : [left];
    });
  }

  const variable = variableFor(sourceCode, value);

  const init =
    variable === null || visited.has(variable) ? null : followedInit(sourceCode, variable);

  return variable === null || init === null
    ? [value]
    : branches(sourceCode, init, new Set([...visited, variable]));
};

export function valueBranches(sourceCode: SourceCode, node: ESTree.Node): ESTree.Node[] {
  return branches(sourceCode, node, new Set());
}

function keyName(sourceCode: SourceCode, property: ESTree.ObjectProperty) {
  return property.computed ? constantString(sourceCode, property.key) : propertyName(property);
}

function propertyLookup(sourceCode: SourceCode, property: ESTree.ObjectProperty) {
  if (property.kind !== "init") {
    return unknown;
  }

  return isGlobal(sourceCode, unwrapExpression(property.value), "undefined")
    ? explicitUndefined
    : { kind: "known" as const, value: property.value };
}

const lookup: (
  sourceCode: SourceCode,
  node: ESTree.Node,
  name: string,
  visited: ReadonlySet<Variable>,
) => Lookup = (sourceCode, node, name, visited) => {
  const value = unwrapExpression(node);

  if (value.type === "Identifier") {
    const variable = variableFor(sourceCode, value);

    const init =
      variable === null || visited.has(variable) ? null : followedInit(sourceCode, variable);

    return variable === null || init === null
      ? unknown
      : lookup(sourceCode, init, name, new Set([...visited, variable]));
  }

  if (value.type !== "ObjectExpression") {
    return unknown;
  }

  return value.properties.reduce<Lookup>((current, property) => {
    if (property.type === "SpreadElement") {
      if (isNullishValue(sourceCode, property.argument)) {
        return current;
      }

      const spread = lookup(sourceCode, property.argument, name, visited);

      return spread.kind === "absent" ? current : spread;
    }

    const key = keyName(sourceCode, property);

    if (key === null) {
      return property.computed ? unknown : current;
    }

    return key === name ? propertyLookup(sourceCode, property) : current;
  }, absent);
};

export function resolveProperty(
  sourceCode: SourceCode,
  node: ESTree.Node,
  name: string,
): ResolvedProperty {
  const result = lookup(sourceCode, node, name, new Set());

  return result.kind === "absent" ? { kind: "missing" } : result;
}
