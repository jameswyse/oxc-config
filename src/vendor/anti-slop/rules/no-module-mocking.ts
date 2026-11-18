// Adapted from dmmulroy/anti-slop
import { defineRule } from "@oxlint/plugins";

import { isModuleMockCall } from "../shared/test-framework-mocks.ts";

export const noModuleMocking = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Vitest and Jest module mocking; tests must replace dependencies through real interfaces.",
    },
    messages: {
      moduleMock:
        "Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (isModuleMockCall(context.sourceCode, node)) {
          context.report({ node, messageId: "moduleMock" });
        }
      },
    };
  },
});
