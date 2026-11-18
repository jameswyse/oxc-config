import { defineRule } from "@oxlint/plugins";

import {
  childNodes,
  effectMember,
  isFunctionNode,
  importedBinding,
  isEffectModule,
  ownReturns,
  pipeSteps,
  propertyName,
  staticPropertyName,
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

function streamFunction(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);
  const binding = value.type === "Identifier" ? importedBinding(sourceCode, value) : null;

  return binding?.source === "effect/Stream" && binding.name !== "*"
    ? binding.name
    : effectMember(sourceCode, value, "Stream");
}

function isSpanOperator(sourceCode: SourceCode, node: ESTree.Node) {
  const name = effectMember(sourceCode, node, "Effect") ?? streamFunction(sourceCode, node);

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

function layerCall(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const callee = unwrapExpression(node.callee);
  const curried = callee.type === "CallExpression" && callee.arguments.length === 1;
  const [tag] = curried ? callee.arguments : node.arguments;

  return {
    layer: effectMember(sourceCode, curried ? callee.callee : callee, "Layer"),
    tag: tag?.type === "SpreadElement" ? undefined : tag,
    implementation: curried ? node.arguments[0] : node.arguments[1],
  };
}

function layerImplementations(
  sourceCode: SourceCode,
  { layer, implementation }: ReturnType<typeof layerCall>,
) {
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

function isStaticMethod(fn: ESTree.Node) {
  return fn.parent?.type === "MethodDefinition" && fn.parent.static;
}

function enclosingClass(node: ESTree.Node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "ClassDeclaration" || current.type === "ClassExpression") {
      return current;
    }

    if (
      (current.type === "FunctionDeclaration" || current.type === "FunctionExpression") &&
      !isStaticMethod(current)
    ) {
      return null;
    }
  }

  return null;
}

function tagDeclaration(sourceCode: SourceCode, tag: ESTree.Node) {
  const value = unwrapExpression(tag);

  if (value.type === "ThisExpression") {
    return enclosingClass(value);
  }

  const definition = variableFor(sourceCode, value)?.defs.at(0)?.node;

  return definition?.type === "ClassDeclaration" ? definition : declaredValue(sourceCode, value);
}

function typeMembers(
  sourceCode: SourceCode,
  type: ESTree.Node | undefined,
  visited: Set<ESTree.Node>,
): ESTree.TSSignature[] {
  if (type?.type === "TSTypeLiteral") {
    return type.members;
  }

  const name =
    type?.type === "TSTypeReference" || type?.type === "TSInterfaceHeritage"
      ? type.type === "TSTypeReference"
        ? type.typeName
        : type.expression
      : null;

  const declaration =
    name?.type === "Identifier" ? variableFor(sourceCode, name)?.defs.at(0)?.node : undefined;

  if (declaration === undefined || visited.has(declaration)) {
    return [];
  }

  visited.add(declaration);

  if (declaration.type === "TSInterfaceDeclaration") {
    return [
      ...declaration.body.body,
      ...declaration.extends.flatMap((heritage) => typeMembers(sourceCode, heritage, visited)),
    ];
  }

  return declaration.type === "TSTypeAliasDeclaration"
    ? typeMembers(sourceCode, declaration.typeAnnotation, visited)
    : [];
}

function serviceKeyOperations(sourceCode: SourceCode, key: ESTree.Node | null) {
  const callee = key?.type === "CallExpression" ? unwrapExpression(key.callee) : null;
  const factory = callee?.type === "CallExpression" ? callee : key;

  if (
    factory?.type !== "CallExpression" ||
    effectMember(sourceCode, factory.callee, "Context") !== "Service"
  ) {
    return [];
  }

  const [identifier, operations] = factory.typeArguments?.params ?? [];

  return typeMembers(sourceCode, operations ?? identifier, new Set());
}

function serviceKey(declaration: ESTree.Node | null) {
  const isClass =
    declaration?.type === "ClassDeclaration" || declaration?.type === "ClassExpression";

  return isClass && declaration.superClass ? unwrapExpression(declaration.superClass) : declaration;
}

function serviceName(tag: ESTree.Node, declaration: ESTree.Node | null) {
  const value = unwrapExpression(tag);

  if (
    (declaration?.type === "ClassDeclaration" || declaration?.type === "ClassExpression") &&
    declaration.id
  ) {
    return declaration.id.name;
  }

  return value.type === "Identifier" ? value.name : "Service";
}

function declaredReturnType(member: ESTree.TSSignature) {
  if (member.type === "TSMethodSignature") {
    return member.returnType?.typeAnnotation ?? null;
  }

  const type = member.type === "TSPropertySignature" ? member.typeAnnotation?.typeAnnotation : null;

  return type?.type === "TSFunctionType" ? type.returnType.typeAnnotation : null;
}

function isStreamType(sourceCode: SourceCode, type: ESTree.TSType | null | undefined) {
  const name = type?.type === "TSTypeReference" ? type.typeName : null;

  if (name?.type === "Identifier") {
    const binding = importedBinding(sourceCode, name);

    return binding?.source === "effect/Stream" && binding.name === "Stream";
  }

  return (
    name?.type === "TSQualifiedName" &&
    name.right.name === "Stream" &&
    isEffectModule(sourceCode, name.left, "Stream")
  );
}

function declaresStream(
  sourceCode: SourceCode,
  operations: readonly ESTree.TSSignature[],
  name: string,
) {
  const member = operations.find(
    (signature) =>
      (signature.type === "TSPropertySignature" || signature.type === "TSMethodSignature") &&
      staticPropertyName(signature) === name,
  );

  return member !== undefined && isStreamType(sourceCode, declaredReturnType(member));
}

const streamExitFamilies = /^(?:run|mk|to)(?:[A-Z]|$)/u;

const streamExits = new Set([
  "isStream",
  "partition",
  "partitionEffect",
  "partitionQueue",
  "peel",
  "broadcast",
  "broadcastN",
  "share",
]);

function isStreamExit(name: string) {
  return streamExits.has(name) || streamExitFamilies.test(name);
}

function streamMember(sourceCode: SourceCode, node: ESTree.Node): string | null {
  const value = unwrapExpression(node);

  return value.type === "CallExpression"
    ? streamMember(sourceCode, value.callee)
    : streamFunction(sourceCode, value);
}

function isStreamExpression(
  sourceCode: SourceCode,
  node: ESTree.Node,
  visited: Set<ESTree.Node>,
): boolean {
  const value = unwrapExpression(node);

  if (value.type === "ConditionalExpression" || value.type === "LogicalExpression") {
    const [first, second] =
      value.type === "ConditionalExpression"
        ? [value.consequent, value.alternate]
        : [value.left, value.right];

    return (
      isStreamExpression(sourceCode, first, visited) ||
      isStreamExpression(sourceCode, second, visited)
    );
  }

  const member = streamMember(sourceCode, value);

  if (member !== null) {
    return !isStreamExit(member);
  }

  if (value.type === "Identifier") {
    const bound = declaredValue(sourceCode, value);

    if (bound === value || visited.has(bound)) {
      return false;
    }

    visited.add(bound);

    return isStreamExpression(sourceCode, bound, visited);
  }

  if (value.type !== "CallExpression") {
    return false;
  }

  const pipe = pipeSteps(sourceCode, value);

  if (pipe !== null) {
    const last = pipe.steps.at(-1);
    const step = last === undefined ? null : streamMember(sourceCode, last);

    if (pipe.input === null) {
      return false;
    }

    return last === undefined
      ? isStreamExpression(sourceCode, pipe.input, visited)
      : step !== null && !isStreamExit(step);
  }

  const callee = declaredValue(sourceCode, value.callee);

  if (!isFunctionNode(callee) || visited.has(callee)) {
    return false;
  }

  visited.add(callee);

  return (
    isStreamType(sourceCode, callee.returnType?.typeAnnotation) ||
    ownReturns(callee, sourceCode.visitorKeys).some((returned) =>
      isStreamExpression(sourceCode, returned, visited),
    )
  );
}

function returnsStream(sourceCode: SourceCode, operation: FunctionNode) {
  return (
    isStreamType(sourceCode, operation.returnType?.typeAnnotation) ||
    ownReturns(operation, sourceCode.visitorKeys).some((returned) =>
      isStreamExpression(sourceCode, returned, new Set([operation])),
    )
  );
}

function untracedOperation(sourceCode: SourceCode, property: ESTree.Node) {
  if (property.type !== "Property" || property.kind !== "init") {
    return null;
  }

  const operation = declaredValue(sourceCode, property.value);

  if (!isFunctionNode(operation)) {
    return isUnnamedEffectFn(sourceCode, operation) ? operation : null;
  }

  return operation.async ||
    someOwnNode(
      sourceCode,
      operation,
      (node) => isSpan(sourceCode, node) || callsSpannedFunction(sourceCode, node),
    )
    ? null
    : operation;
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
        'Service operation `{{name}}` has no span, so traces don\'t show its calls, timing or failures. Define it with `Effect.fn("{{service}}.{{name}}")`, which takes the existing function or a generator, or with a generator in `Effect.fnUntraced` when tracing it adds nothing.',
      untracedStream:
        'Service operation `{{name}}` returns a Stream with no span, so traces don\'t show its runs, timing or failures. Pipe the Stream through `Stream.withSpan("{{service}}.{{name}}")`.',
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const { sourceCode } = context;
        const call = layerCall(sourceCode, node);
        const implementations = layerImplementations(sourceCode, call);

        if (implementations.length === 0) {
          return;
        }

        const declaration = call.tag === undefined ? null : tagDeclaration(sourceCode, call.tag);
        const service = call.tag === undefined ? "Service" : serviceName(call.tag, declaration);
        const operations = serviceKeyOperations(sourceCode, serviceKey(declaration));

        for (const implementation of implementations) {
          for (const property of implementation.properties) {
            const operation = untracedOperation(sourceCode, property);

            if (operation === null) {
              continue;
            }

            const name = staticPropertyName(property) ?? "operation";

            const streams =
              declaresStream(sourceCode, operations, name) ||
              (isFunctionNode(operation) && returnsStream(sourceCode, operation));

            context.report({
              node: property,
              messageId: streams ? "untracedStream" : "untraced",
              data: { name, service },
            });
          }
        }
      },
    };
  },
});
