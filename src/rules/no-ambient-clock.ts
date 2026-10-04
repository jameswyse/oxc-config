import { defineRule } from "@oxlint/plugins";

import { propertyName, isGlobalValue, isInjectionSeam } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

export const noAmbientClock = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Read the current date and time only in a clock owner." },
    schema: [],
    messages: {
      clock:
        "Accept the current time from the caller or an injected clock. If this module owns the clock, add it to the `clock` owners.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function check(node: ESTree.Node, date: ESTree.Node): void {
      if (isGlobalValue(sourceCode, date, "Date") && !isInjectionSeam(node)) {
        context.report({ node, messageId: "clock" });
      }
    }

    return {
      MemberExpression(node) {
        if (propertyName(node) === "now") {
          check(node, node.object);
        }
      },
      NewExpression(node) {
        if (node.arguments.length === 0) {
          check(node, node.callee);
        }
      },
      CallExpression(node) {
        check(node, node.callee);
      },
    };
  },
});
