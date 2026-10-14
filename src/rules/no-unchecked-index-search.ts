import { defineRule } from "@oxlint/plugins";

import { staticPropertyName, unwrapExpression } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

const searches = new Set(["indexOf", "lastIndexOf", "findIndex", "findLastIndex"]);

const indexedArguments = new Map([
  ["splice", 1],
  ["toSpliced", 1],
  ["with", 1],
  ["at", 1],
  ["slice", 2],
]);

function searchCall(node: ESTree.Node): string | null {
  const call = unwrapExpression(node);

  const name =
    call.type === "CallExpression" && call.callee.type === "MemberExpression"
      ? staticPropertyName(call.callee)
      : null;

  return name !== null && searches.has(name) ? name : null;
}

export const noUncheckedIndexSearch = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require a missing-item check before using a searched index." },
    schema: [],
    messages: {
      unchecked:
        "`{{search}}` returns -1 when nothing matches, and here -1 counts from the end, so a missing item silently targets the last element. Store the index and handle -1 first.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const method =
          node.callee.type === "MemberExpression" ? staticPropertyName(node.callee) : null;

        const count = method === null ? undefined : indexedArguments.get(method);

        for (const argument of node.arguments.slice(0, count ?? 0)) {
          const search = searchCall(argument);

          if (search !== null) {
            context.report({ node: argument, messageId: "unchecked", data: { search } });
          }
        }
      },
    };
  },
});
