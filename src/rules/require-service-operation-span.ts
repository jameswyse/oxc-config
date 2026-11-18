import { defineRule } from "@oxlint/plugins";

import {
  childNodes,
  effectMember,
  isFunctionNode,
  ownReturns,
  propertyName,
  staticString,
  unchangedInit,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

import type { FunctionNode } from "../shared/index.ts";

const effectLayers = new Set(["effect", "scoped"]);

const valueLayers = new Set(["succeed", "sync"]);

const spanOperators = new Set(["withSpan", "fnUntraced"]);

function declaredValue(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  if (value.type !== "Identifier") {
    return value;
  }

  const variable = variableFor(sourceCode, value);
  const definition = variable?.defs.at(0);

  if (definition?.type === "FunctionName" && definition.node.type === "FunctionDeclaration") {
    return definition.node;
  }

  const initializer = variable === null ? null : unchangedInit(variable);

  return initializer === null ? value : unwrapExpression(initializer);
}

function isNamedEffectFn(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  if (value.type !== "CallExpression") {
    return false;
  }

  const factory = unwrapExpression(value.callee);

  return (
    factory.type === "CallExpression" &&
    effectMember(sourceCode, factory.callee, "Effect") === "fn" &&
    staticString(factory.arguments[0]) !== null
  );
}

function isSpanOperator(sourceCode: SourceCode, node: ESTree.Node) {
  const name = effectMember(sourceCode, node, "Effect") ?? effectMember(sourceCode, node, "Stream");

  return name !== null && spanOperators.has(name);
}

function isGeneratorBody(sourceCode: SourceCode, node: ESTree.Node) {
  const parent = node.parent;

  return (
    parent?.type === "CallExpression" &&
    effectMember(sourceCode, parent.callee, "Effect") === "gen" &&
    parent.arguments.some((argument) => argument === node)
  );
}

function someOwnNode(
  sourceCode: SourceCode,
  node: ESTree.Node,
  matches: (node: ESTree.Node) => boolean,
): boolean {
  return (
    matches(node) ||
    childNodes(node, sourceCode.visitorKeys).some(
      (child) =>
        (!isFunctionNode(child) || isGeneratorBody(sourceCode, child)) &&
        someOwnNode(sourceCode, child, matches),
    )
  );
}

function isSpan(sourceCode: SourceCode, node: ESTree.Node) {
  return isNamedEffectFn(sourceCode, node) || isSpanOperator(sourceCode, node);
}

function callsSpannedFunction(sourceCode: SourceCode, node: ESTree.Node) {
  if (node.type !== "CallExpression") {
    return false;
  }

  const callee = declaredValue(sourceCode, node.callee);

  if (callee === unwrapExpression(node.callee)) {
    return false;
  }

  return isFunctionNode(callee)
    ? someOwnNode(sourceCode, callee, (inner) => isSpan(sourceCode, inner))
    : isSpan(sourceCode, callee);
}

function isUnnamedEffectFn(sourceCode: SourceCode, node: ESTree.Node) {
  return (
    node.type === "CallExpression" &&
    effectMember(sourceCode, node.callee, "Effect") === "fn" &&
    staticString(node.arguments[0]) === null
  );
}

function implementationObject(
  sourceCode: SourceCode,
  node: ESTree.Node,
): ESTree.ObjectExpression | null {
  const value = declaredValue(sourceCode, node);

  if (value.type === "ObjectExpression") {
    return value;
  }

  if (value.type !== "CallExpression") {
    return null;
  }

  const callee = unwrapExpression(value.callee);
  const [argument] = value.arguments;

  return callee.type === "MemberExpression" &&
    propertyName(callee) === "of" &&
    argument !== undefined &&
    argument.type !== "SpreadElement"
    ? implementationObject(sourceCode, argument)
    : null;
}

function generatorImplementations(sourceCode: SourceCode, node: ESTree.Node) {
  const value = declaredValue(sourceCode, node);

  if (value.type !== "CallExpression") {
    return [];
  }

  const callee = unwrapExpression(value.callee);

  if (callee.type === "MemberExpression" && propertyName(callee) === "pipe") {
    return generatorImplementations(sourceCode, callee.object);
  }

  if (effectMember(sourceCode, callee, "Effect") !== "gen") {
    return [];
  }

  const generator = value.arguments.find(
    (argument): argument is FunctionNode =>
      argument.type !== "SpreadElement" && isFunctionNode(argument),
  );

  return generator === undefined
    ? []
    : ownReturns(generator, sourceCode.visitorKeys).flatMap((returned) => {
        const implementation = implementationObject(sourceCode, returned);

        return implementation === null ? [] : [implementation];
      });
}

function layerImplementations(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const callee = unwrapExpression(node.callee);
  const curried = callee.type === "CallExpression" && callee.arguments.length === 1;
  const layer = effectMember(sourceCode, curried ? callee.callee : callee, "Layer");
  const implementation = curried ? node.arguments[0] : node.arguments[1];

  if (layer === null || implementation === undefined || implementation.type === "SpreadElement") {
    return [];
  }

  if (effectLayers.has(layer)) {
    return generatorImplementations(sourceCode, implementation);
  }

  if (!valueLayers.has(layer)) {
    return [];
  }

  const value = declaredValue(sourceCode, implementation);

  const built =
    layer === "sync" && isFunctionNode(value) ? ownReturns(value, sourceCode.visitorKeys) : [value];

  return built.flatMap((returned) => {
    const object = implementationObject(sourceCode, returned);

    return object === null ? [] : [object];
  });
}

function untracedOperation(sourceCode: SourceCode, property: ESTree.Node) {
  if (property.type !== "Property" || property.kind !== "init") {
    return false;
  }

  const operation = declaredValue(sourceCode, property.value);

  if (!isFunctionNode(operation)) {
    return isUnnamedEffectFn(sourceCode, operation);
  }

  return (
    !operation.async &&
    !someOwnNode(
      sourceCode,
      operation,
      (node) => isSpan(sourceCode, node) || callsSpannedFunction(sourceCode, node),
    )
  );
}

export const requireServiceOperationSpan = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        'Require each operation a service layer provides to be traced with `Effect.fn("Service.operation")`.',
    },
    messages: {
      untraced:
        'Service operation `{{name}}` has no span, so traces don\'t show its calls, timing or failures. Define it with `Effect.fn("Service.{{name}}")`, or with `Effect.fnUntraced` when tracing it adds nothing.',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        for (const implementation of layerImplementations(context.sourceCode, node)) {
          for (const property of implementation.properties) {
            if (untracedOperation(context.sourceCode, property)) {
              context.report({
                node: property,
                messageId: "untraced",
                data: { name: propertyName(property) ?? "operation" },
              });
            }
          }
        }
      },
    };
  },
});
