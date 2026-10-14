import { defineRule } from "@oxlint/plugins";

import { isGlobalValue, isPlaywright, propertyName } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

const clockControls =
  /\b(?:useFakeTimers|setSystemTime|TestClock|mock\.timers|clock\.install|clock\.setFixedTime)\b/u;

export const noUncontrolledTestClock = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require tests that read the current time to control the clock." },
    schema: [],
    messages: {
      clock:
        "This test reads the real clock, so its result depends on when it runs. Use a fixed date, or control time with fake timers.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    const drivesBrowser = sourceCode.ast.body.some(
      (statement) => statement.type === "ImportDeclaration" && isPlaywright(statement.source.value),
    );

    if (drivesBrowser || clockControls.test(sourceCode.text)) {
      return {};
    }

    function check(node: ESTree.Node, date: ESTree.Node): void {
      if (isGlobalValue(sourceCode, date, "Date")) {
        context.report({ node, messageId: "clock" });
      }
    }

    return {
      CallExpression(node) {
        if (node.callee.type === "MemberExpression" && propertyName(node.callee) === "now") {
          check(node, node.callee.object);
        }
      },
      NewExpression(node) {
        if (node.arguments.length === 0) {
          check(node, node.callee);
        }
      },
    };
  },
});
