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

function enclosingClass(node: ESTree.Node) {
  for (let current = node.parent; current; current = current.parent) {
    if (current.type === "ClassDeclaration" || current.type === "ClassExpression") {
      return current;
    }

    if (current.type === "FunctionDeclaration" || current.type === "FunctionExpression") {
      return null;
    }
  }

  return null;
}

function serviceClass(sourceCode: SourceCode, tag: ESTree.Node) {
  const value = unwrapExpression(tag);

  if (value.type === "ThisExpression") {
    return enclosingClass(value);
  }

  const definition = variableFor(sourceCode, value)?.defs.at(0)?.node;

  const declared =
    definition?.type === "ClassDeclaration" ? definition : declaredValue(sourceCode, value);

  return declared.type === "ClassDeclaration" || declared.type === "ClassExpression"
    ? declared
    : null;
}

function serviceName(tag: ESTree.Node | undefined, service: ESTree.Class | null) {
  const value = tag === undefined ? null : unwrapExpression(tag);

  return service?.id?.name ?? (value?.type === "Identifier" ? value.name : "Service");
}

function typeMembers(sourceCode: SourceCode, type: ESTree.TSType | undefined) {
  if (type?.type === "TSTypeLiteral") {
    return type.members;
  }

  if (type?.type !== "TSTypeReference" || type.typeName.type !== "Identifier") {
    return [];
  }

  const declaration = variableFor(sourceCode, type.typeName)?.defs.at(0)?.node;

  if (declaration?.type === "TSInterfaceDeclaration") {
    return declaration.body.body;
  }

  return declaration?.type === "TSTypeAliasDeclaration" &&
    declaration.typeAnnotation.type === "TSTypeLiteral"
    ? declaration.typeAnnotation.members
    : [];
}

function serviceOperations(sourceCode: SourceCode, service: ESTree.Class | null) {
  const superClass = service?.superClass ? unwrapExpression(service.superClass) : null;

  const factory =
    superClass?.type === "CallExpression" ? unwrapExpression(superClass.callee) : null;

  return factory?.type === "CallExpression" &&
    effectMember(sourceCode, factory.callee, "Context") === "Service"
    ? typeMembers(sourceCode, factory.typeArguments?.params[1])
    : [];
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

function declaresStream(sourceCode: SourceCode, service: ESTree.Class | null, name: string) {
  const member = serviceOperations(sourceCode, service).find(
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

function streamMember(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  return (
    effectMember(sourceCode, value, "Stream") ??
    (value.type === "CallExpression" ? effectMember(sourceCode, value.callee, "Stream") : null)
  );
}

function isStreamExpression(
  sourceCode: SourceCode,
  node: ESTree.Node,
  visited: Set<ESTree.Node>,
): boolean {
  const value = unwrapExpression(node);

  if (value.type === "ConditionalExpression") {
    return (
      isStreamExpression(sourceCode, value.consequent, visited) ||
      isStreamExpression(sourceCode, value.alternate, visited)
    );
  }

  const member = streamMember(sourceCode, value);

  if (member !== null) {
    return !isStreamExit(member);
  }

  if (value.type === "Identifier") {
    const bound = declaredValue(sourceCode, value);

    return bound !== value && isStreamExpression(sourceCode, bound, visited);
  }

  if (value.type !== "CallExpression") {
    return false;
  }

  const pipe = pipeSteps(sourceCode, value);

  if (pipe !== null) {
    const last = pipe.steps.at(-1);
    const step = last === undefined ? null : streamMember(sourceCode, last);

    return last === undefined
      ? pipe.input !== null && isStreamExpression(sourceCode, pipe.input, visited)
      : step !== null && !isStreamExit(step);
  }

  const callee = declaredValue(sourceCode, value.callee);

  if (!isFunctionNode(callee) || visited.has(callee)) {
    return false;
  }

  visited.add(callee);

  return ownReturns(callee, sourceCode.visitorKeys).some((returned) =>
    isStreamExpression(sourceCode, returned, visited),
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

        const { tag } = call;
        const service = tag === undefined ? null : serviceClass(sourceCode, tag);

        for (const implementation of implementations) {
          for (const property of implementation.properties) {
            const operation = untracedOperation(sourceCode, property);

            if (operation === null) {
              continue;
            }

            const name = staticPropertyName(property) ?? "operation";

            const streams =
              declaresStream(sourceCode, service, name) ||
              (isFunctionNode(operation) && returnsStream(sourceCode, operation));

            context.report({
              node: property,
              messageId: streams ? "untracedStream" : "untraced",
              data: { name, service: serviceName(tag, service) },
            });
          }
        }
      },
    };
  },
});
