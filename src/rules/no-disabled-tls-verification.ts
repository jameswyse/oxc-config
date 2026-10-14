import { defineRule } from "@oxlint/plugins";

import { isGlobal, staticPropertyName, unwrapExpression } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

function isFalse(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);

  return value.type === "Literal" && value.value === false;
}

function isDisabledFlag(node: ESTree.Node): boolean {
  const value = unwrapExpression(node);

  return (value.type === "Literal" && (value.value === "0" || value.value === 0)) || isFalse(value);
}

export const noDisabledTlsVerification = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow turning off TLS certificate verification." },
    schema: [],
    messages: {
      disabled:
        "This turns off TLS certificate verification, so any server can impersonate the real one. Trust the right certificate authority instead, such as with the `ca` option or `NODE_EXTRA_CA_CERTS`.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Property(node) {
        if (staticPropertyName(node) === "rejectUnauthorized" && isFalse(node.value)) {
          context.report({ node, messageId: "disabled" });
        }
      },
      AssignmentExpression(node) {
        const target = unwrapExpression(node.left);

        const environment =
          target.type === "MemberExpression" ? unwrapExpression(target.object) : null;

        if (
          target.type === "MemberExpression" &&
          staticPropertyName(target) === "NODE_TLS_REJECT_UNAUTHORIZED" &&
          environment?.type === "MemberExpression" &&
          staticPropertyName(environment) === "env" &&
          isGlobal(sourceCode, unwrapExpression(environment.object), "process") &&
          isDisabledFlag(node.right)
        ) {
          context.report({ node, messageId: "disabled" });
        }
      },
    };
  },
});
