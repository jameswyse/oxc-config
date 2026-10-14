import { defineRule } from "@oxlint/plugins";

import { childNodes } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const secretAutocomplete = new Set(["current-password", "new-password", "one-time-code"]);

function attribute(
  element: ESTree.JSXOpeningElement,
  name: string,
): ESTree.JSXAttribute | undefined {
  return element.attributes.find(
    (item): item is ESTree.JSXAttribute =>
      item.type === "JSXAttribute" && item.name.type === "JSXIdentifier" && item.name.name === name,
  );
}

function literalValue(item: ESTree.JSXAttribute | undefined): string | null {
  const value =
    item?.value?.type === "JSXExpressionContainer" ? item.value.expression : item?.value;

  if (value?.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis[0]?.value.cooked?.toLowerCase() ?? null;
  }

  return value?.type === "Literal" && typeof value.value === "string"
    ? value.value.toLowerCase()
    : null;
}

function isElement(element: ESTree.JSXOpeningElement, name: string): boolean {
  return element.name.type === "JSXIdentifier" && element.name.name === name;
}

function isSecretInput(element: ESTree.JSXOpeningElement): boolean {
  return (
    isElement(element, "input") &&
    (literalValue(attribute(element, "type")) === "password" ||
      secretAutocomplete.has(literalValue(attribute(element, "autoComplete")) ?? ""))
  );
}

function submitsByGet(element: ESTree.JSXOpeningElement): boolean {
  const action = attribute(element, "action");
  const method = attribute(element, "method");

  return (
    !element.attributes.some((item) => item.type === "JSXSpreadAttribute") &&
    (action === undefined || literalValue(action) !== null) &&
    (method === undefined || literalValue(method) === "get")
  );
}

function formContents(sourceCode: SourceCode, root: ESTree.Node): ESTree.JSXOpeningElement[] {
  const elements: ESTree.JSXOpeningElement[] = [];
  const pending = childNodes(root, sourceCode.visitorKeys);

  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.type === "JSXOpeningElement") {
      elements.push(node);
    }

    pending.push(...childNodes(node, sourceCode.visitorKeys));
  }

  return elements;
}

function submitsByGetOverride(element: ESTree.JSXOpeningElement): boolean {
  const type = literalValue(attribute(element, "type"));

  const submits = isElement(element, "button")
    ? type !== "button" && type !== "reset"
    : isElement(element, "input") && (type === "submit" || type === "image");

  return submits && literalValue(attribute(element, "formMethod")) === "get";
}

export const noGetPasswordForm = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require forms with password fields to submit by POST." },
    schema: [],
    messages: {
      get: 'This form has a password field but submits by GET, so a submission before JavaScript loads puts the password in the URL. Add `method="post"` or pass a function `action`.',
    },
  },
  create(context) {
    return {
      JSXElement(node) {
        if (!isElement(node.openingElement, "form")) {
          return;
        }

        const contents = formContents(context.sourceCode, node);

        if (
          contents.some(isSecretInput) &&
          (submitsByGet(node.openingElement) || contents.some(submitsByGetOverride))
        ) {
          context.report({ node: node.openingElement, messageId: "get" });
        }
      },
    };
  },
});
