import { defineRule } from "@oxlint/plugins";

import { childNodes, propertyName, variableFor } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const exposedArgument = new Map<string, number>([
  ["exposeInMainWorld", 1],
  ["exposeInIsolatedWorld", 2],
]);

const listenerMethods = new Set([
  "on",
  "once",
  "addListener",
  "prependListener",
  "prependOnceListener",
]);

function electronName(sourceCode: SourceCode, node: ESTree.Node): string | null {
  if (node.type === "MemberExpression") {
    return propertyName(node);
  }

  if (node.type !== "Identifier") {
    return null;
  }

  const definition = variableFor(sourceCode, node)?.defs[0];

  if (definition?.type === "ImportBinding" && definition.node.type === "ImportSpecifier") {
    const { imported } = definition.node;

    return imported.type === "Literal" ? imported.value : imported.name;
  }

  return node.name;
}

function isPropertyPosition(node: ESTree.Node): boolean {
  const parent = node.parent;

  return (
    (parent?.type === "MemberExpression" && parent.property === node && !parent.computed) ||
    (parent?.type === "Property" && parent.key === node && parent.value !== node)
  );
}

function isWithin(node: ESTree.Node, root: ESTree.Node): boolean {
  for (let current: ESTree.Node | null = node; current; current = current.parent) {
    if (current === root) {
      return true;
    }
  }

  return false;
}

function isParameterOf(
  sourceCode: SourceCode,
  node: ESTree.Argument | undefined,
  root: ESTree.Node,
): node is ESTree.IdentifierReference {
  return (
    node?.type === "Identifier" &&
    Boolean(
      variableFor(sourceCode, node)?.defs.some(
        (definition) => definition.type === "Parameter" && isWithin(definition.node, root),
      ),
    )
  );
}

function resolveConstant(sourceCode: SourceCode, node: ESTree.Argument): ESTree.Argument {
  if (node.type !== "Identifier") {
    return node;
  }

  const definitions = variableFor(sourceCode, node)?.defs ?? [];
  const definition = definitions.length === 1 ? definitions[0] : null;

  return definition?.type === "Variable" &&
    definition.parent?.type === "VariableDeclaration" &&
    definition.parent.kind === "const" &&
    definition.node.type === "VariableDeclarator" &&
    definition.node.id.type === "Identifier" &&
    definition.node.init
    ? definition.node.init
    : node;
}

function walk(
  node: ESTree.Node,
  visitorKeys: SourceCode["visitorKeys"],
  visit: (node: ESTree.Node) => void,
): void {
  visit(node);

  for (const child of childNodes(node, visitorKeys)) {
    walk(child, visitorKeys, visit);
  }
}

export const electronNoRawIpcRendererExposure = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow exposing ipcRenderer, its methods or arbitrary channels through contextBridge.",
    },
    schema: [],
    messages: {
      exposed:
        "Expose narrow functions that call fixed IPC channels, never ipcRenderer or its methods.",
      channel:
        "Use a fixed IPC channel. Forwarding a renderer-supplied channel lets the renderer reach every IPC handler.",
      listener:
        "Wrap the renderer callback and pass it only the payload. Passing it to ipcRenderer.{{method}} hands the renderer the IPC event and its sender.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function isIpcRenderer(node: ESTree.Node): boolean {
      return (
        (node.type === "Identifier" || node.type === "MemberExpression") &&
        !isPropertyPosition(node) &&
        electronName(sourceCode, node) === "ipcRenderer"
      );
    }

    function checkCall(call: ESTree.CallExpression, method: string, root: ESTree.Node): void {
      const [channel, listener] = call.arguments;

      if (channel?.type === "SpreadElement" || isParameterOf(sourceCode, channel, root)) {
        context.report({ node: channel, messageId: "channel" });
      }

      if (listenerMethods.has(method) && isParameterOf(sourceCode, listener, root)) {
        context.report({ node: listener, messageId: "listener", data: { method } });
      }
    }

    function check(node: ESTree.Node, root: ESTree.Node): void {
      if (!isIpcRenderer(node)) {
        return;
      }

      const member = node.parent;

      const method =
        member?.type === "MemberExpression" && member.object === node ? propertyName(member) : null;

      const call = member?.parent;

      if (method && call?.type === "CallExpression" && call.callee === member) {
        checkCall(call, method, root);

        return;
      }

      context.report({ node, messageId: "exposed" });
    }

    return {
      CallExpression(node) {
        const callee = node.callee;

        if (callee.type !== "MemberExpression") {
          return;
        }

        const name = propertyName(callee);
        const index = name === null ? undefined : exposedArgument.get(name);

        if (index === undefined || electronName(sourceCode, callee.object) !== "contextBridge") {
          return;
        }

        const exposed = node.arguments[index];

        if (exposed) {
          const root = resolveConstant(sourceCode, exposed);

          walk(root, sourceCode.visitorKeys, (child) => check(child, root));
        }
      },
    };
  },
});
