import { defineRule } from "@oxlint/plugins";

import { isFunctionNode, outermostExpression, ownReturns, propertyName } from "../shared/index.ts";
import { isEmittedClassMember, locallyExportedNames } from "../shared/module-exports.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

import type { FunctionNode } from "../shared/index.ts";

type ClassMember = ESTree.MethodDefinition | ESTree.PropertyDefinition | ESTree.AccessorProperty;

type ExportReach = {
  readonly node: ESTree.Node;
  readonly parent: ESTree.Node | null;
};

const expressionParts = new Set([
  "ArrayExpression",
  "AssignmentExpression",
  "CallExpression",
  "ChainExpression",
  "ClassBody",
  "ConditionalExpression",
  "LogicalExpression",
  "MemberExpression",
  "NewExpression",
  "ObjectExpression",
  "ParenthesizedExpression",
  "SequenceExpression",
  "SpreadElement",
  "TaggedTemplateExpression",
  "TemplateLiteral",
  "TSAsExpression",
  "TSInstantiationExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

function isClassMember(node: ESTree.Node | null): node is ClassMember {
  return (
    node?.type === "MethodDefinition" ||
    node?.type === "PropertyDefinition" ||
    node?.type === "AccessorProperty"
  );
}

function passesExportThrough(parent: ESTree.Node, child: ESTree.Node) {
  if (isClassMember(parent)) {
    return parent.value === child && isEmittedClassMember(parent);
  }

  if (parent.type === "Property") {
    return parent.value === child;
  }

  if (parent.type === "ClassDeclaration" || parent.type === "ClassExpression") {
    return parent.body === child || parent.superClass === child;
  }

  return expressionParts.has(parent.type);
}

function exportReach(start: ESTree.Node) {
  let node = start;
  let parent = start.parent;

  while (parent && passesExportThrough(parent, node)) {
    node = parent;
    parent = node.parent;
  }

  return { node, parent };
}

function isExportedStatement(
  statement: ESTree.Node,
  name: string | undefined,
  exportedNames: ReadonlySet<string>,
) {
  const parent = statement.parent;

  return (
    parent?.type === "ExportNamedDeclaration" ||
    parent?.type === "ExportDefaultDeclaration" ||
    (parent?.type === "Program" && name !== undefined && exportedNames.has(name))
  );
}

function isExportedReach({ node, parent }: ExportReach, exportedNames: ReadonlySet<string>) {
  if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
    return isExportedStatement(node, node.id?.name, exportedNames);
  }

  if (parent?.type === "VariableDeclarator") {
    const name = parent.id.type === "Identifier" ? parent.id.name : undefined;

    return parent.init === node && isExportedStatement(parent.parent, name, exportedNames);
  }

  return parent?.type === "ExportDefaultDeclaration" || parent?.type === "TSExportAssignment";
}

function reachedBinding(sourceCode: SourceCode, { node, parent }: ExportReach) {
  if ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") && node.id) {
    const name = node.id.name;

    return sourceCode.getDeclaredVariables(node).find((variable) => variable.name === name);
  }

  return parent?.type === "VariableDeclarator" &&
    parent.init === node &&
    parent.id.type === "Identifier"
    ? sourceCode.getDeclaredVariables(parent)[0]
    : undefined;
}

function exportFeedCheck(sourceCode: SourceCode, program: ESTree.Program) {
  const exportedNames = locallyExportedNames(program.body);
  const globalScope = sourceCode.getScope(program);

  const programScope =
    globalScope.childScopes.find((scope) => scope.block === program) ?? globalScope;

  const readers = new Map<Variable, Variable[]>();
  const toVisit: Variable[] = [];

  for (const variable of programScope.variables) {
    for (const reference of variable.references.filter((each) => each.isRead())) {
      const reach = exportReach(reference.identifier);
      const binding = reachedBinding(sourceCode, reach);

      if (isExportedReach(reach, exportedNames)) {
        toVisit.push(variable);
      } else if (binding !== undefined) {
        readers.set(binding, [...(readers.get(binding) ?? []), variable]);
      }
    }
  }

  const reached = new Set<Variable>();

  for (const variable of toVisit) {
    if (!reached.has(variable)) {
      reached.add(variable);
      toVisit.push(...(readers.get(variable) ?? []));
    }
  }

  function feedsExport(reach: ExportReach) {
    const binding = reachedBinding(sourceCode, reach);

    return isExportedReach(reach, exportedNames) || (binding !== undefined && reached.has(binding));
  }

  return feedsExport;
}

function ownBinding(sourceCode: SourceCode, fn: FunctionNode) {
  if (fn.type !== "ArrowFunctionExpression" && fn.id) {
    const name = fn.id.name;

    return sourceCode.getDeclaredVariables(fn).find((variable) => variable.name === name);
  }

  const declarator = fn.parent;

  return declarator.type === "VariableDeclarator" && declarator.init === fn
    ? sourceCode.getDeclaredVariables(declarator)[0]
    : undefined;
}

function isWithin(node: ESTree.Node, fn: FunctionNode) {
  return node.range[0] > fn.range[0] && node.range[1] <= fn.range[1];
}

function referencesOwnName(sourceCode: SourceCode, fn: FunctionNode) {
  return (
    ownBinding(sourceCode, fn)?.references.some(({ identifier }) => isWithin(identifier, fn)) ??
    false
  );
}

function ownerMember(fn: FunctionNode) {
  const parent = fn.parent;

  return (isClassMember(parent) || parent.type === "Property") && parent.value === fn
    ? parent
    : null;
}

function isCalledMember(identifier: ESTree.Node, name: string) {
  const member = identifier.parent;

  return (
    member?.type === "MemberExpression" &&
    member.object === identifier &&
    propertyName(member) === name &&
    member.parent.type === "CallExpression" &&
    member.parent.callee === member
  );
}

function callsThroughObjectBinding(
  sourceCode: SourceCode,
  fn: FunctionNode,
  property: ESTree.ObjectProperty,
  name: string,
) {
  const object = outermostExpression(property.parent);
  const declarator = object.parent;

  if (declarator?.type !== "VariableDeclarator" || declarator.init !== object) {
    return false;
  }

  return (
    sourceCode
      .getDeclaredVariables(declarator)[0]
      ?.references.some(
        ({ identifier }) => isWithin(identifier, fn) && isCalledMember(identifier, name),
      ) ?? false
  );
}

function classBindings(sourceCode: SourceCode, member: ESTree.Node) {
  const classNode = member.parent?.parent;

  if (classNode?.type !== "ClassDeclaration" && classNode?.type !== "ClassExpression") {
    return [];
  }

  const declarator = outermostExpression(classNode).parent;

  return [
    ...sourceCode.getDeclaredVariables(classNode),
    ...(declarator?.type === "VariableDeclarator" &&
    declarator.init === outermostExpression(classNode)
      ? sourceCode.getDeclaredVariables(declarator)
      : []),
  ];
}

function callsThroughClassBinding(
  sourceCode: SourceCode,
  fn: FunctionNode,
  member: ESTree.Node,
  name: string,
) {
  return classBindings(sourceCode, member).some((variable) =>
    variable.references.some(
      ({ identifier }) => isWithin(identifier, fn) && isCalledMember(identifier, name),
    ),
  );
}

function thisOwner(node: ESTree.Node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "FunctionExpression" || current.type === "FunctionDeclaration") {
      return current;
    }

    if (current.type === "ArrowFunctionExpression" && isClassMember(current.parent)) {
      return current;
    }

    if (isClassMember(current) || current.type === "StaticBlock") {
      return null;
    }
  }

  return null;
}

const keywordTypes = new Set([
  "TSBigIntKeyword",
  "TSBooleanKeyword",
  "TSNullKeyword",
  "TSNumberKeyword",
  "TSStringKeyword",
  "TSSymbolKeyword",
  "TSUndefinedKeyword",
  "TSVoidKeyword",
]);

function isKeywordType(type: ESTree.TSType) {
  const members = type.type === "TSUnionType" ? type.types : [type];

  return members.every((member) => keywordTypes.has(member.type));
}

function resultExpressions(node: ESTree.Node): ESTree.Node[] {
  if (node.type === "ParenthesizedExpression") {
    return resultExpressions(node.expression);
  }

  if (node.type === "AwaitExpression") {
    return resultExpressions(node.argument);
  }

  if (node.type === "ConditionalExpression") {
    return [...resultExpressions(node.consequent), ...resultExpressions(node.alternate)];
  }

  if (node.type === "LogicalExpression") {
    return [...resultExpressions(node.left), ...resultExpressions(node.right)];
  }

  const last = node.type === "SequenceExpression" ? node.expressions.at(-1) : undefined;

  return last === undefined ? [node] : resultExpressions(last);
}

function hasTypeAnnotation(parameter: ESTree.Node): boolean {
  if (parameter.type === "TSParameterProperty") {
    return hasTypeAnnotation(parameter.parameter);
  }

  if (parameter.type === "AssignmentPattern") {
    return hasTypeAnnotation(parameter.left);
  }

  return "typeAnnotation" in parameter && parameter.typeAnnotation !== null;
}

function fnResults(fn: FunctionNode, sourceCode: SourceCode) {
  return ownReturns(fn, sourceCode.visitorKeys).flatMap(resultExpressions);
}

function needsContext(node: ESTree.Node, sourceCode: SourceCode): boolean {
  if (isFunctionNode(node)) {
    return (
      !node.params.every(hasTypeAnnotation) ||
      (!node.returnType &&
        fnResults(node, sourceCode).some((result) => needsContext(result, sourceCode)))
    );
  }

  if (node.type === "ObjectExpression" || node.type === "ArrayExpression") {
    return true;
  }

  if (node.type === "Literal") {
    return ["string", "number", "bigint", "boolean"].includes(typeof node.value);
  }

  if (node.type !== "CallExpression" && node.type !== "NewExpression") {
    return false;
  }

  return (
    !node.typeArguments &&
    ((node.type === "NewExpression" && node.arguments.length === 0) ||
      node.arguments.some(
        (argument) =>
          argument.type !== "SpreadElement" &&
          resultExpressions(argument).some((result) => needsContext(result, sourceCode)),
      ))
  );
}

function isCall(node: ESTree.Node) {
  return node.type === "CallExpression" || node.type === "NewExpression";
}

function annotationTypesReturns(
  fn: FunctionNode,
  annotation: ESTree.TSType,
  sourceCode: SourceCode,
) {
  if (fn.generator) {
    return true;
  }

  if (isKeywordType(annotation)) {
    return false;
  }

  const results = fnResults(fn, sourceCode);

  return (
    results.filter(isCall).length > 1 || results.some((result) => needsContext(result, sourceCode))
  );
}

export const noInternalReturnTypes = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Let TypeScript infer the return types of functions outside the module's exported API.",
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      explicitReturnType:
        "Remove the return type and let TypeScript infer it. Pin a type with a typed variable or `satisfies` at the return site where it matters.",
      removeReturnType: "Remove the return type annotation.",
    },
  },
  create(context) {
    const { sourceCode } = context;
    const thisCalls = new Map<ESTree.Node, Set<string>>();
    let feedsExport: ((reach: ExportReach) => boolean) | null = null;

    function callsItselfAsMember(fn: FunctionNode) {
      const member = ownerMember(fn);
      const name = member ? propertyName(member) : null;

      if (!member || name === null) {
        return false;
      }

      return (
        thisCalls.get(fn)?.has(name) === true ||
        (member.type === "Property" && callsThroughObjectBinding(sourceCode, fn, member, name)) ||
        (member.type !== "Property" &&
          member.static &&
          callsThroughClassBinding(sourceCode, fn, member, name))
      );
    }

    function isExportedApi(fn: FunctionNode) {
      feedsExport ??= exportFeedCheck(sourceCode, sourceCode.ast);

      return feedsExport(exportReach(fn));
    }

    function check(fn: FunctionNode) {
      const returnType = fn.returnType;
      const annotation = returnType?.typeAnnotation;

      if (
        !returnType ||
        !annotation ||
        !fn.body ||
        annotation.type === "TSTypePredicate" ||
        annotation.type === "TSNeverKeyword" ||
        annotationTypesReturns(fn, annotation, sourceCode) ||
        isExportedApi(fn) ||
        referencesOwnName(sourceCode, fn) ||
        callsItselfAsMember(fn)
      ) {
        return;
      }

      context.report({
        node: returnType,
        messageId: "explicitReturnType",
        suggest: [{ messageId: "removeReturnType", fix: (fixer) => fixer.remove(returnType) }],
      });
    }

    return {
      CallExpression({ callee }) {
        if (callee.type !== "MemberExpression" || callee.object.type !== "ThisExpression") {
          return;
        }

        const name = propertyName(callee);
        const owner = thisOwner(callee);

        if (owner && name !== null) {
          thisCalls.set(owner, (thisCalls.get(owner) ?? new Set()).add(name));
        }
      },
      "FunctionDeclaration:exit": check,
      "FunctionExpression:exit": check,
      "ArrowFunctionExpression:exit": check,
    };
  },
});
