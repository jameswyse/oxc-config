import { defineRule } from "@oxlint/plugins";

import {
  isGlobal,
  isGlobalValue,
  outermostExpression,
  staticPropertyName,
  unwrapExpression,
} from "../shared/index.ts";

import type { ESTree, Reference, SourceCode, Variable } from "@oxlint/plugins";

const bodyReaders = new Set(["json", "text", "arrayBuffer", "blob", "formData", "bytes"]);

const statusChecks = new Set(["ok", "status"]);

const metadata = new Set(["headers", "url", "redirected", "type"]);

function unwrap(node: ESTree.Node): ESTree.Node {
  const value = unwrapExpression(node);

  return value.type === "AwaitExpression" ? unwrap(value.argument) : value;
}

function isFetch(sourceCode: SourceCode, node: ESTree.Node | null): boolean {
  const value = node === null ? null : unwrap(node);

  return value?.type === "CallExpression" && isGlobalValue(sourceCode, value.callee, "fetch");
}

type Use = "body" | "check" | "metadata" | "other";

function isLogged(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const position = node.parent;

  return (
    position?.type === "TemplateLiteral" ||
    (position?.type === "CallExpression" &&
      position.arguments.some((argument) => argument === node) &&
      position.callee.type === "MemberExpression" &&
      isGlobal(sourceCode, position.callee.object, "console"))
  );
}

function use(sourceCode: SourceCode, reference: Reference): Use {
  const response = outermostExpression(reference.identifier);
  const member = response.parent;

  if (member?.type !== "MemberExpression" || member.object !== response) {
    return "other";
  }

  const name = staticPropertyName(member);

  if (name !== null && statusChecks.has(name)) {
    return isLogged(sourceCode, outermostExpression(member)) ? "metadata" : "check";
  }

  if (name !== null && metadata.has(name)) {
    return "metadata";
  }

  return name !== null &&
    bodyReaders.has(name) &&
    member.parent.type === "CallExpression" &&
    member.parent.callee === member
    ? "body"
    : "other";
}

function readsBodyUnchecked(sourceCode: SourceCode, variables: readonly Variable[]): boolean {
  const uses = variables.flatMap((variable) =>
    variable.references
      .filter((reference) => reference.isRead())
      .map((reference) => use(sourceCode, reference)),
  );

  return uses.includes("body") && uses.every((item) => item === "body" || item === "metadata");
}

export const noUncheckedFetchResponse = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require a status check before reading a fetch response body." },
    schema: [],
    messages: {
      unchecked:
        "This reads the response body without checking `ok` or `status`, so an error response is treated as data. Check the status first.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      VariableDeclarator(node) {
        if (
          node.id.type === "Identifier" &&
          isFetch(sourceCode, node.init) &&
          readsBodyUnchecked(sourceCode, sourceCode.getDeclaredVariables(node))
        ) {
          context.report({ node, messageId: "unchecked" });
        }
      },
      CallExpression(node) {
        const member = node.callee;
        const name = member.type === "MemberExpression" ? staticPropertyName(member) : null;

        if (member.type !== "MemberExpression" || name === null) {
          return;
        }

        if (bodyReaders.has(name) && isFetch(sourceCode, member.object)) {
          context.report({ node, messageId: "unchecked" });

          return;
        }

        const [callback] = node.arguments;

        if (
          name === "then" &&
          isFetch(sourceCode, member.object) &&
          (callback?.type === "ArrowFunctionExpression" ||
            callback?.type === "FunctionExpression") &&
          callback.params[0]?.type === "Identifier" &&
          readsBodyUnchecked(
            sourceCode,
            sourceCode
              .getDeclaredVariables(callback)
              .filter((variable) =>
                variable.defs.some((definition) => definition.type === "Parameter"),
              ),
          )
        ) {
          context.report({ node: callback, messageId: "unchecked" });
        }
      },
    };
  },
});
