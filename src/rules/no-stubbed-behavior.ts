import { defineRule } from "@oxlint/plugins";

import {
  effectMember,
  functionUses,
  importedBinding,
  isEffectModule,
  isFunctionNode,
  isGlobal,
  isPlaywright,
  outermostExpression,
  ownReturns,
  staticPropertyName,
  staticString,
  unchangedInit,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";
import { isNullishValue, resolveProperty, valueBranches } from "../shared/object-properties.ts";
import {
  isModuleMockCall,
  isNodeTestMock,
  isSpyOnlyCall,
  testFrameworkMethod,
} from "../vendor/anti-slop/shared/test-framework-mocks.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

import type { FunctionNode } from "../shared/index.ts";

type Snapshot = {
  readonly variable: Variable;
  readonly key: string;
  readonly end: number;
};

const implementationMethods = new Set([
  "mockImplementation",
  "mockImplementationOnce",
  "mockReturnValue",
  "mockReturnValueOnce",
  "mockResolvedValue",
  "mockResolvedValueOnce",
  "mockRejectedValue",
  "mockRejectedValueOnce",
  "mockReturnThis",
  "withImplementation",
]);

const replacementMethods = {
  vi: new Set(["stubGlobal", "importMock", "mockObject"]),
  jest: new Set([
    "replaceProperty",
    "setMock",
    "createMockFromModule",
    "genMockFromModule",
    "enableAutomock",
  ]),
};

const nodeReplacementMethods = new Set(["method", "getter", "setter"]);

const globalObjects = new Set(["globalThis", "window", "global", "self"]);

const globalRoots = new Set([
  ...globalObjects,
  "console",
  "process",
  "document",
  "navigator",
  "location",
  "history",
  "localStorage",
  "sessionStorage",
  "performance",
  "crypto",
  "Date",
  "Math",
  "Intl",
  "Response",
  "Request",
  "Headers",
  "URL",
  "URLSearchParams",
  "FormData",
  "Blob",
  "File",
  "AbortController",
  "AbortSignal",
  "WebSocket",
  "XMLHttpRequest",
  "EventSource",
]);

const runtimeGlobalNames = new Set([
  ...globalRoots,
  "fetch",
  "matchMedia",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "queueMicrotask",
  "structuredClone",
  "ResizeObserver",
  "IntersectionObserver",
  "MutationObserver",
]);

const effectServiceModules = ["Context", "Effect", "ServiceMap"];

const responseFactories = new Set(["json", "error", "redirect"]);

function mockApiCall(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const api = testFrameworkMethod(sourceCode, call.callee);

  if (api !== null) {
    return api;
  }

  const callee = unwrapExpression(call.callee);
  const method = callee.type === "MemberExpression" ? staticPropertyName(callee) : null;

  return callee.type === "MemberExpression" &&
    method !== null &&
    isNodeTestMock(sourceCode, callee.object)
    ? { framework: "node" as const, method }
    : null;
}

function isImplementationArgument(sourceCode: SourceCode, argument: ESTree.Argument | undefined) {
  if (argument === undefined || argument.type === "SpreadElement") {
    return false;
  }

  const value = unwrapExpression(argument);

  return value.type !== "ObjectExpression" && !isGlobal(sourceCode, value, "undefined");
}

function isNoOpFunction(node: ESTree.Node) {
  const value = unwrapExpression(node);

  return (
    (value.type === "ArrowFunctionExpression" || value.type === "FunctionExpression") &&
    value.body?.type === "BlockStatement" &&
    value.body.body.length === 0
  );
}

function isMockFunction(sourceCode: SourceCode, node: ESTree.Node): node is ESTree.CallExpression {
  return node.type === "CallExpression" && mockApiCall(sourceCode, node)?.method === "fn";
}

function hasImplementation(sourceCode: SourceCode, call: ESTree.CallExpression) {
  return call.arguments.some(
    (argument) => isImplementationArgument(sourceCode, argument) && !isNoOpFunction(argument),
  );
}

function isImplementedMock(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  return isMockFunction(sourceCode, value) && hasImplementation(sourceCode, value);
}

function replacesWithMockApi(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const api = mockApiCall(sourceCode, call);

  if (api === null) {
    return false;
  }

  if (api.method === "fn") {
    return hasImplementation(sourceCode, call);
  }

  if (api.framework === "node") {
    return (
      nodeReplacementMethods.has(api.method) &&
      isImplementationArgument(sourceCode, call.arguments[2])
    );
  }

  return replacementMethods[api.framework].has(api.method) && !isSpyOnlyCall(sourceCode, call, api);
}

function isInlineFunctionValue(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  return (
    value.type === "ArrowFunctionExpression" ||
    value.type === "FunctionExpression" ||
    value.type === "ClassExpression" ||
    isMockFunction(sourceCode, value)
  );
}

function isFunctionValue(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  if (value.type !== "Identifier") {
    return isInlineFunctionValue(sourceCode, value);
  }

  const variable = variableFor(sourceCode, value);
  const definition = variable?.defs[0];

  if (definition?.type === "FunctionName" || definition?.type === "ClassName") {
    return true;
  }

  const init = variable ? unchangedInit(variable) : null;

  return init !== null && isInlineFunctionValue(sourceCode, init);
}

function isBuiltInConstructor(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  return (
    value.type === "Identifier" &&
    /^[A-Z]/.test(value.name) &&
    isGlobal(sourceCode, value, value.name)
  );
}

const isGlobalTarget: (sourceCode: SourceCode, node: ESTree.Node) => boolean = (
  sourceCode,
  node,
) => {
  const value = unwrapExpression(node);

  if (value.type === "Identifier") {
    return globalRoots.has(value.name) && isGlobal(sourceCode, value, value.name);
  }

  if (value.type !== "MemberExpression") {
    return false;
  }

  return (
    (staticPropertyName(value) === "prototype" && isBuiltInConstructor(sourceCode, value.object)) ||
    isGlobalTarget(sourceCode, value.object)
  );
};

function isReplaceableName(name: string | null): name is string {
  return name !== null && !/^on[a-z]+$/.test(name);
}

function replacesGlobalByAssignment(sourceCode: SourceCode, node: ESTree.AssignmentExpression) {
  const target = node.left;

  if (isImplementedMock(sourceCode, node.right) || !isFunctionValue(sourceCode, node.right)) {
    return false;
  }

  if (target.type === "Identifier") {
    return runtimeGlobalNames.has(target.name) && isGlobal(sourceCode, target, target.name);
  }

  return (
    target.type === "MemberExpression" &&
    isReplaceableName(staticPropertyName(target)) &&
    isGlobalTarget(sourceCode, target.object)
  );
}

function memberPath(node: ESTree.Node) {
  const names: string[] = [];
  let value = unwrapExpression(node);

  while (value.type === "MemberExpression") {
    const name = staticPropertyName(value);

    if (name === null) {
      return null;
    }

    names.unshift(name);
    value = unwrapExpression(value.object);
  }

  return value.type === "Identifier" && names.length > 0 ? { root: value, names } : null;
}

function isThroughProcessEnv(path: readonly string[]) {
  return path.some((name, index) => name === "process" && path[index + 1] === "env");
}

const isGlobalMemberPath: (root: string, members: readonly string[]) => boolean = (
  root,
  members,
) => {
  const [first, ...rest] = members;

  if (globalObjects.has(root)) {
    return (
      (members.length <= 2 && runtimeGlobalNames.has(first ?? "")) ||
      (first !== undefined && rest.length > 0 && isGlobalMemberPath(first, rest))
    );
  }

  if (members.length === 1) {
    return globalRoots.has(root);
  }

  return members.length === 2 && first === "prototype" && /^[A-Z]/.test(root);
};

function deletesGlobal(sourceCode: SourceCode, node: ESTree.Node) {
  const member = memberPath(node);

  return (
    member !== null &&
    isReplaceableName(member.names.at(-1) ?? null) &&
    isGlobal(sourceCode, member.root, member.root.name) &&
    !isThroughProcessEnv([member.root.name, ...member.names]) &&
    isGlobalMemberPath(member.root.name, member.names)
  );
}

function objectProperties(node: ESTree.Node | undefined) {
  const value = node ? unwrapExpression(node) : null;

  return value?.type === "ObjectExpression"
    ? value.properties.filter((property) => property.type === "Property")
    : [];
}

function isReplacingValue(sourceCode: SourceCode, node: ESTree.Node) {
  return (
    isFunctionValue(sourceCode, node) ||
    objectProperties(node).some(
      (property) =>
        isReplaceableName(staticPropertyName(property)) &&
        isFunctionValue(sourceCode, property.value),
    )
  );
}

function isReplacingDescriptor(sourceCode: SourceCode, node: ESTree.Node | undefined) {
  return objectProperties(node).some((property) => {
    const key = staticPropertyName(property);

    return (
      key === "get" ||
      key === "set" ||
      (key === "value" && isReplacingValue(sourceCode, property.value))
    );
  });
}

function replacesGlobalByDefinition(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const callee = unwrapExpression(call.callee);
  const [target, second, third] = call.arguments;

  if (
    callee.type !== "MemberExpression" ||
    target === undefined ||
    target.type === "SpreadElement" ||
    !isGlobalTarget(sourceCode, target)
  ) {
    return false;
  }

  const owner = unwrapExpression(callee.object);
  const method = staticPropertyName(callee);

  if (
    method === "defineProperty" &&
    (isGlobal(sourceCode, owner, "Object") || isGlobal(sourceCode, owner, "Reflect"))
  ) {
    return isReplaceableName(staticString(second)) && isReplacingDescriptor(sourceCode, third);
  }

  if (!isGlobal(sourceCode, owner, "Object")) {
    return false;
  }

  if (method === "defineProperties") {
    return objectProperties(second).some(
      (property) =>
        isReplaceableName(staticPropertyName(property)) &&
        isReplacingDescriptor(sourceCode, property.value),
    );
  }

  return (
    method === "assign" &&
    call.arguments
      .slice(1)
      .some((source) =>
        objectProperties(source).some(
          (property) =>
            isReplaceableName(staticPropertyName(property)) &&
            isReplacingValue(sourceCode, property.value),
        ),
      )
  );
}

function boundFunction(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  if (isFunctionNode(value)) {
    return value;
  }

  const variable = variableFor(sourceCode, value);
  const definition = variable?.defs[0];

  if (definition?.type === "FunctionName" && isFunctionNode(definition.node)) {
    return definition.node;
  }

  const init = variable ? unchangedInit(variable) : null;
  const initValue = init ? unwrapExpression(init) : null;

  return initValue && isFunctionNode(initValue) ? initValue : null;
}

const constructsResponse: (sourceCode: SourceCode, node: ESTree.Node) => boolean = (
  sourceCode,
  node,
) => {
  const value = unwrapExpression(node);

  if (value.type === "NewExpression") {
    return isGlobal(sourceCode, unwrapExpression(value.callee), "Response");
  }

  const callee = value.type === "CallExpression" ? unwrapExpression(value.callee) : null;

  if (value.type !== "CallExpression" || callee?.type !== "MemberExpression") {
    return false;
  }

  const owner = unwrapExpression(callee.object);
  const method = staticPropertyName(callee);
  const [argument] = value.arguments;

  if (isGlobal(sourceCode, owner, "Promise") && method === "resolve") {
    return argument !== undefined && constructsResponse(sourceCode, argument);
  }

  return isGlobal(sourceCode, owner, "Response") && responseFactories.has(method ?? "");
};

function isFetchTransport(sourceCode: SourceCode, node: ESTree.Node) {
  const transport = boundFunction(sourceCode, node);

  return (
    transport !== null &&
    ownReturns(transport, sourceCode.visitorKeys).some((returned) =>
      constructsResponse(sourceCode, returned),
    )
  );
}

function calleeName(callee: ESTree.Node) {
  if (callee.type === "Identifier") {
    return callee.name;
  }

  return callee.type === "MemberExpression" ? staticPropertyName(callee) : null;
}

function isLayerCall(sourceCode: SourceCode, callee: ESTree.Node) {
  return (
    effectMember(sourceCode, callee, "Layer") !== null ||
    (callee.type === "CallExpression" && effectMember(sourceCode, callee.callee, "Layer") !== null)
  );
}

function definitionRoot(node: ESTree.Node) {
  let value = unwrapExpression(node);

  while (
    value.type === "CallExpression" ||
    value.type === "MemberExpression" ||
    value.type === "TSInstantiationExpression"
  ) {
    value = unwrapExpression(
      value.type === "CallExpression"
        ? value.callee
        : value.type === "MemberExpression"
          ? value.object
          : value.expression,
    );
  }

  return value;
}

function isEffectService(sourceCode: SourceCode, node: ESTree.Node) {
  const variable = variableFor(sourceCode, unwrapExpression(node));
  const definition = variable?.defs[0];

  const source =
    definition?.type === "ClassName" && definition.node.type === "ClassDeclaration"
      ? definition.node.superClass
      : variable
        ? unchangedInit(variable)
        : null;

  const root = source ? definitionRoot(source) : null;

  return (
    root !== null && effectServiceModules.some((module) => isEffectModule(sourceCode, root, module))
  );
}

function isServedObject(sourceCode: SourceCode, object: ESTree.ObjectExpression) {
  const outer = outermostExpression(object);
  const parent = outer.parent;

  if (parent?.type === "ExportDefaultDeclaration") {
    return true;
  }

  if (parent?.type !== "CallExpression" || !parent.arguments.some((item) => item === outer)) {
    return false;
  }

  const callee = unwrapExpression(parent.callee);

  return (
    /serve/i.test(calleeName(callee) ?? "") ||
    isLayerCall(sourceCode, callee) ||
    (callee.type === "MemberExpression" &&
      staticPropertyName(callee) === "of" &&
      isEffectService(sourceCode, callee.object))
  );
}

function isFetchType(declarator: ESTree.VariableDeclarator) {
  const annotation =
    declarator.id.type === "Identifier" ? declarator.id.typeAnnotation?.typeAnnotation : null;

  const name = annotation?.type === "TSTypeQuery" ? annotation.exprName : null;

  if (name?.type === "Identifier") {
    return name.name === "fetch";
  }

  return (
    name?.type === "TSQualifiedName" &&
    name.left.type === "Identifier" &&
    name.left.name === "globalThis" &&
    name.right.name === "fetch"
  );
}

function isPlaywrightModule(source: string) {
  return source === "playwright" || isPlaywright(source);
}

function isPlaywrightRouteType(sourceCode: SourceCode, typeName: ESTree.TSTypeName) {
  if (typeName.type === "TSQualifiedName") {
    const namespace =
      typeName.left.type === "Identifier" ? importedBinding(sourceCode, typeName.left) : null;

    return (
      typeName.right.name === "Route" &&
      namespace?.name === "*" &&
      isPlaywrightModule(namespace.source)
    );
  }

  if (typeName.type !== "Identifier") {
    return false;
  }

  if (!variableFor(sourceCode, typeName)?.defs.length) {
    return typeName.name === "Route";
  }

  const binding = importedBinding(sourceCode, typeName);

  return binding?.name === "Route" && isPlaywrightModule(binding.source);
}

function hasRouteType(sourceCode: SourceCode, parameter: ESTree.Node | undefined) {
  const annotation =
    parameter?.type === "Identifier" ? parameter.typeAnnotation?.typeAnnotation : null;

  return (
    annotation?.type === "TSTypeReference" && isPlaywrightRouteType(sourceCode, annotation.typeName)
  );
}

function isRouteHandler(sourceCode: SourceCode, handler: FunctionNode) {
  if (hasRouteType(sourceCode, handler.params[0])) {
    return true;
  }

  return functionUses(sourceCode, handler).some((use) => {
    const call = use.parent;
    const callee = call?.type === "CallExpression" ? unwrapExpression(call.callee) : null;

    return (
      call?.type === "CallExpression" &&
      call.arguments[1] === use &&
      callee?.type === "MemberExpression" &&
      (staticPropertyName(callee) ?? "").startsWith("route")
    );
  });
}

function isRouteParameter(sourceCode: SourceCode, node: ESTree.Node) {
  const definition = variableFor(sourceCode, unwrapExpression(node))?.defs[0];
  const handler = definition?.type === "Parameter" ? definition.node : null;

  return (
    handler !== null &&
    isFunctionNode(handler) &&
    handler.params[0] === definition?.name &&
    isRouteHandler(sourceCode, handler)
  );
}

function hasFixedOptions(sourceCode: SourceCode, node: ESTree.Node) {
  return valueBranches(sourceCode, node).some((options) => {
    const response = resolveProperty(sourceCode, options, "response");

    if (response.kind === "known") {
      return valueBranches(sourceCode, response.value).some((branch) =>
        isNullishValue(sourceCode, branch),
      );
    }

    return response.kind !== "unknown";
  });
}

function fulfillsFixedRoute(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const callee = unwrapExpression(call.callee);
  const [options] = call.arguments;

  if (
    callee.type !== "MemberExpression" ||
    staticPropertyName(callee) !== "fulfill" ||
    !isRouteParameter(sourceCode, callee.object)
  ) {
    return false;
  }

  if (options === undefined) {
    return true;
  }

  return options.type !== "SpreadElement" && hasFixedOptions(sourceCode, options);
}

function usesOriginal(sourceCode: SourceCode, replacement: ESTree.Node, original: Variable) {
  const wrapper = boundFunction(sourceCode, replacement) ?? unwrapExpression(replacement);
  const [start, end] = wrapper.range;

  return original.references.some(
    (reference) => reference.identifier.range[0] >= start && reference.identifier.range[1] <= end,
  );
}

export const noStubbedBehavior = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Run the real implementation in tests, intercept the network with MSW, and use spies only to observe.",
    },
    schema: [],
    messages: {
      double:
        "Use the real implementation instead of replacing it. Intercept network requests with MSW, and use spies only to observe calls.",
      network:
        "Serve this response from an MSW handler instead of a hand-written fetch or fixed route response, so the real client code runs.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const reported = new Set<ESTree.Node>();
    const snapshots: Snapshot[] = [];
    const assignments = new Map<string, ESTree.AssignmentExpression[]>();
    const rootIds = new Map<Variable | string, number>();

    function insideModuleMock(node: ESTree.Node) {
      for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
        if (ancestor.type === "CallExpression" && isModuleMockCall(sourceCode, ancestor)) {
          return true;
        }
      }

      return false;
    }

    function report(node: ESTree.Node, messageId: "double" | "network") {
      if (reported.has(node) || insideModuleMock(node)) {
        return;
      }

      reported.add(node);
      context.report({ node, messageId });
    }

    function memberKey(node: ESTree.Node) {
      const member = memberPath(node);

      if (member === null) {
        return null;
      }

      const root = variableFor(sourceCode, member.root) ?? member.root.name;
      const id = rootIds.get(root) ?? rootIds.size;

      rootIds.set(root, id);

      return `${id}:${member.names.join(".")}`;
    }

    return {
      CallExpression(node) {
        const callee = unwrapExpression(node.callee);

        if (
          (callee.type === "MemberExpression" &&
            implementationMethods.has(staticPropertyName(callee) ?? "")) ||
          replacesWithMockApi(sourceCode, node) ||
          replacesGlobalByDefinition(sourceCode, node)
        ) {
          report(node, "double");
        }

        if (fulfillsFixedRoute(sourceCode, node)) {
          report(node, "network");
        }
      },
      AssignmentExpression(node) {
        if (node.operator !== "=") {
          return;
        }

        const key = node.left.type === "MemberExpression" ? memberKey(node.left) : null;

        const observesOriginal = snapshots.some(
          (snapshot) =>
            snapshot.key === key && usesOriginal(sourceCode, node.right, snapshot.variable),
        );

        if (!observesOriginal && replacesGlobalByAssignment(sourceCode, node)) {
          report(node, "double");
        }

        if (key !== null) {
          const keyed = assignments.get(key);

          if (keyed === undefined) {
            assignments.set(key, [node]);
          } else {
            keyed.push(node);
          }
        }
      },
      UnaryExpression(node) {
        if (node.operator === "delete" && deletesGlobal(sourceCode, node.argument)) {
          report(node, "double");
        }
      },
      Property(node) {
        if (
          node.parent.type === "ObjectExpression" &&
          staticPropertyName(node) === "fetch" &&
          !isServedObject(sourceCode, node.parent) &&
          isFetchTransport(sourceCode, node.value)
        ) {
          report(node.value, "network");
        }
      },
      VariableDeclarator(node) {
        if (node.init && isFetchType(node) && isFetchTransport(sourceCode, node.init)) {
          report(node.init, "network");
        }

        const init = node.init ? unwrapExpression(node.init) : null;
        const [variable] = sourceCode.getDeclaredVariables(node);

        const key = init?.type === "MemberExpression" ? memberKey(init) : null;

        if (
          node.parent.type === "VariableDeclaration" &&
          node.parent.kind === "const" &&
          node.id.type === "Identifier" &&
          key !== null &&
          variable !== undefined
        ) {
          snapshots.push({ variable, key, end: node.range[1] });
        }
      },
      "Program:exit"() {
        for (const snapshot of snapshots) {
          const patches = (assignments.get(snapshot.key) ?? []).filter(
            (assignment) => assignment.range[0] > snapshot.end,
          );

          const restores = patches.filter((patch) => {
            const value = unwrapExpression(patch.right);

            return (
              value.type === "Identifier" && variableFor(sourceCode, value) === snapshot.variable
            );
          });

          const lastRestore = Math.max(...restores.map((restore) => restore.range[0]));

          for (const patch of patches) {
            if (
              patch.range[0] < lastRestore &&
              patch.left.type === "MemberExpression" &&
              isReplaceableName(staticPropertyName(patch.left)) &&
              !isImplementedMock(sourceCode, patch.right) &&
              isFunctionValue(sourceCode, patch.right) &&
              !usesOriginal(sourceCode, patch.right, snapshot.variable)
            ) {
              report(patch, "double");
            }
          }
        }
      },
    };
  },
});
