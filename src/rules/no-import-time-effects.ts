import { defineRule } from "@oxlint/plugins";

import { childNodes, isGlobalValue, propertyName, unwrapExpression } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const functionTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
]);

const startedTimers = ["setInterval", "setTimeout", "fetch"];

const openedResources = ["BroadcastChannel", "WebSocket", "EventSource", "Worker", "SharedWorker"];

const registrations = new Set(["addEventListener", "listen"]);

function isDeferred(node: ESTree.Node): boolean {
  return (
    functionTypes.has(node.type) ||
    ((node.type === "PropertyDefinition" || node.type === "AccessorProperty") && !node.static)
  );
}

function isInsideFunction(node: ESTree.Node): boolean {
  for (let ancestor = node.parent; ancestor !== null; ancestor = ancestor.parent) {
    if (functionTypes.has(ancestor.type)) {
      return true;
    }
  }

  return false;
}

function immediateBody(node: ESTree.Node): ESTree.Node | null {
  const callee = node.type === "CallExpression" ? unwrapExpression(node.callee) : null;

  return callee?.type === "ArrowFunctionExpression" ||
    (callee?.type === "FunctionExpression" && !callee.generator)
    ? callee.body
    : null;
}

function effect(sourceCode: SourceCode, node: ESTree.Node): string | null {
  if (node.type === "AwaitExpression") {
    return isInsideFunction(node) ? null : "await";
  }

  if (node.type === "NewExpression") {
    return openedResources.find((name) => isGlobalValue(sourceCode, node.callee, name)) ?? null;
  }

  if (node.type !== "CallExpression") {
    return null;
  }

  const timer = startedTimers.find((name) => isGlobalValue(sourceCode, node.callee, name));

  if (timer !== undefined) {
    return timer;
  }

  const method = node.callee.type === "MemberExpression" ? propertyName(node.callee) : null;

  if (method !== null && registrations.has(method)) {
    return method;
  }

  return node.callee.type === "MemberExpression" &&
    (method === "on" || method === "once") &&
    isGlobalValue(sourceCode, node.callee.object, "process")
    ? `process.${method}`
    : null;
}

export const noImportTimeEffects = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow timers, I/O, open resources and handler registration when a module is imported.",
    },
    schema: [],
    messages: {
      effect:
        "`{{effect}}` runs when this module is imported, so every importer starts it, including tests. Move it into a function the entrypoint calls.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program(program) {
        const pending: ESTree.Node[] = [...program.body];

        for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
          const found = effect(sourceCode, node);

          if (found !== null) {
            context.report({ node, messageId: "effect", data: { effect: found } });
          }

          const body = immediateBody(node);

          if (body !== null) {
            pending.push(body);
          }

          if (!isDeferred(node)) {
            pending.push(...childNodes(node, sourceCode.visitorKeys));
          } else if (
            (node.type === "PropertyDefinition" || node.type === "AccessorProperty") &&
            node.computed
          ) {
            pending.push(node.key);
          }
        }
      },
    };
  },
});
