import { defineRule } from "@oxlint/plugins";

import {
  importedBinding,
  isGlobal,
  staticPropertyName,
  unchangedDeclarator,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

type ImportedObject = {
  readonly source: string;
  readonly path: readonly (string | null)[];
};

const processModules = new Set(["process", "node:process"]);

const mutatingMethods = {
  Object: new Set(["assign", "defineProperty", "defineProperties"]),
  Reflect: new Set(["set", "defineProperty", "deleteProperty"]),
};

const aliasCache = new WeakMap<Variable, ImportedObject | null>();

function patternPath(pattern: ESTree.Node, target: ESTree.Node): (string | null)[] | null {
  if (pattern === target) {
    return [];
  }

  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties) {
      const path = property.type === "Property" ? patternPath(property.value, target) : null;

      if (path !== null) {
        return [staticPropertyName(property), ...path];
      }
    }
  }

  if (pattern.type === "ArrayPattern") {
    for (const [index, element] of pattern.elements.entries()) {
      const path =
        element === null || element.type === "RestElement" ? null : patternPath(element, target);

      if (path !== null) {
        return [String(index), ...path];
      }
    }
  }

  return null;
}

function aliasSource(variable: Variable) {
  const declarator = unchangedDeclarator(variable);
  const name = variable.defs[0]?.name;
  const path = declarator?.init && name ? patternPath(declarator.id, name) : null;

  return declarator?.init && path ? { init: declarator.init, path } : null;
}

function importedObject(sourceCode: SourceCode, node: ESTree.Node): ImportedObject | null {
  const value = unwrapExpression(node);

  if (value.type === "ChainExpression") {
    return importedObject(sourceCode, value.expression);
  }

  if (value.type === "MemberExpression") {
    const owner = importedObject(sourceCode, value.object);

    return owner && { source: owner.source, path: [...owner.path, staticPropertyName(value)] };
  }

  const variable = variableFor(sourceCode, value);

  if (variable === null || variable.defs[0]?.type === "ImportBinding") {
    const binding = importedBinding(sourceCode, value);

    return binding && { source: binding.source, path: binding.name === "*" ? [] : [binding.name] };
  }

  if (!aliasCache.has(variable)) {
    aliasCache.set(variable, null);

    const alias = aliasSource(variable);
    const owner = alias && importedObject(sourceCode, alias.init);

    aliasCache.set(
      variable,
      owner && { source: owner.source, path: [...owner.path, ...alias.path] },
    );
  }

  return aliasCache.get(variable) ?? null;
}

function isSharedObject(sourceCode: SourceCode, node: ESTree.Node) {
  const object = importedObject(sourceCode, node);

  return object !== null && !processModules.has(object.source);
}

function isSharedMember(sourceCode: SourceCode, node: ESTree.Node) {
  const target = unwrapExpression(node);
  const member = target.type === "ChainExpression" ? target.expression : target;

  return member.type === "MemberExpression" && isSharedObject(sourceCode, member);
}

function assignedTargets(target: ESTree.Node): ESTree.Node[] {
  if (target.type === "ArrayPattern") {
    return target.elements.flatMap((element) => (element ? assignedTargets(element) : []));
  }

  if (target.type === "ObjectPattern") {
    return target.properties.flatMap((property) =>
      assignedTargets(property.type === "Property" ? property.value : property),
    );
  }

  if (target.type === "RestElement") {
    return assignedTargets(target.argument);
  }

  return target.type === "AssignmentPattern" ? assignedTargets(target.left) : [target];
}

function isSamePath(left: ImportedObject, right: ImportedObject) {
  return (
    left.source === right.source &&
    left.path.length === right.path.length &&
    left.path.every((key, index) => key !== null && key === right.path[index])
  );
}

function savedOriginal(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  return variableFor(sourceCode, value)?.defs[0]?.type === "Variable"
    ? importedObject(sourceCode, value)
    : null;
}

function restoresOriginal(sourceCode: SourceCode, node: ESTree.AssignmentExpression) {
  const original = savedOriginal(sourceCode, node.right);
  const target = importedObject(sourceCode, node.left);

  return (
    node.operator === "=" && original !== null && target !== null && isSamePath(original, target)
  );
}

function mutatingMethod(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const callee = unwrapExpression(call.callee);

  if (callee.type !== "MemberExpression") {
    return null;
  }

  const owner = unwrapExpression(callee.object);
  const method = staticPropertyName(callee) ?? "";

  if (isGlobal(sourceCode, owner, "Object") && mutatingMethods.Object.has(method)) {
    return method;
  }

  return isGlobal(sourceCode, owner, "Reflect") && mutatingMethods.Reflect.has(method)
    ? method
    : null;
}

function mutatesSharedImport(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const [target] = call.arguments;

  return (
    mutatingMethod(sourceCode, call) !== null &&
    target !== undefined &&
    target.type !== "SpreadElement" &&
    isSharedObject(sourceCode, target)
  );
}

export const noMutatedImports = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep imported module objects unchanged in tests, so one test's setup cannot leak into another.",
    },
    schema: [],
    messages: {
      mutation:
        "Changing an imported module's object leaks into every test that shares the module. Pass the value through options or parameters, or use an override the module scopes to one call.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      AssignmentExpression(node) {
        if (
          assignedTargets(node.left).some((target) => isSharedMember(sourceCode, target)) &&
          !restoresOriginal(sourceCode, node)
        ) {
          context.report({ node, messageId: "mutation" });
        }
      },
      UpdateExpression(node) {
        if (isSharedMember(sourceCode, node.argument)) {
          context.report({ node, messageId: "mutation" });
        }
      },
      UnaryExpression(node) {
        if (node.operator === "delete" && isSharedMember(sourceCode, node.argument)) {
          context.report({ node, messageId: "mutation" });
        }
      },
      CallExpression(node) {
        if (mutatesSharedImport(sourceCode, node)) {
          context.report({ node, messageId: "mutation" });
        }
      },
    };
  },
});
