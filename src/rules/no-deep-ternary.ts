import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

export const noDeepTernary = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Allow one level of nested ternaries without deeper conditional chains." },
    schema: [],
    messages: {
      depth:
        "This ternary is nested more than one level. Use named branches, a lookup or a switch.",
    },
  },
  create(context) {
    return {
      ConditionalExpression(node) {
        let depth = 1;

        for (let ancestor: ESTree.Node | null = node.parent; ancestor; ancestor = ancestor.parent) {
          if (
            ["ArrowFunctionExpression", "FunctionExpression", "FunctionDeclaration"].includes(
              ancestor.type,
            )
          ) {
            break;
          }

          if (ancestor.type === "ConditionalExpression") {
            depth += 1;

            if (depth > 3) {
              return;
            }
          }
        }

        if (depth === 3) {
          context.report({ node, messageId: "depth" });
        }
      },
    };
  },
});
