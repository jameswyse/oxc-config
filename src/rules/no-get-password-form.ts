import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const secretAutocomplete = new Set(["current-password", "new-password", "one-time-code"]);

function isOmitted(item: ESTree.JSXAttribute): boolean {
  const value = item.value?.type === "JSXExpressionContainer" ? item.value.expression : null;

  return (
    (value?.type === "Identifier" && value.name === "undefined") ||
    (value?.type === "Literal" && value.value === null)
  );
}

function attribute(
  element: ESTree.JSXOpeningElement,
  name: string,
): ESTree.JSXAttribute | undefined {
  return element.attributes.find(
    (item): item is ESTree.JSXAttribute =>
      item.type === "JSXAttribute" &&
      item.name.type === "JSXIdentifier" &&
      item.name.name === name &&
      !isOmitted(item),
  );
}

function stringValue(item: ESTree.JSXAttribute | undefined): string | null {
  const value =
    item?.value?.type === "JSXExpressionContainer" ? item.value.expression : item?.value;

  if (value?.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis[0]?.value.cooked ?? null;
  }

  return value?.type === "Literal" && typeof value.value === "string" ? value.value : null;
}

function literalValue(item: ESTree.JSXAttribute | undefined): string | null {
  return stringValue(item)?.toLowerCase() ?? null;
}

function isElement(element: ESTree.JSXOpeningElement, name: string): boolean {
  return element.name.type === "JSXIdentifier" && element.name.name === name;
}

function isSecretInput(element: ESTree.JSXOpeningElement): boolean {
  return (
    isElement(element, "input") &&
    (literalValue(attribute(element, "type")) === "password" ||
      (literalValue(attribute(element, "autoComplete")) ?? "")
        .split(/\s+/u)
        .some((token) => secretAutocomplete.has(token)))
  );
}

function isGetMethod(item: ESTree.JSXAttribute): boolean {
  const method = literalValue(item);

  return method !== null && method !== "post" && method !== "dialog";
}

function submitsByGet(element: ESTree.JSXOpeningElement): boolean {
  const action = attribute(element, "action");
  const method = attribute(element, "method");

  return (
    !element.attributes.some((item) => item.type === "JSXSpreadAttribute") &&
    (action === undefined || literalValue(action) !== null) &&
    (method === undefined || isGetMethod(method))
  );
}

function submitsByGetOverride(element: ESTree.JSXOpeningElement): boolean {
  const type = literalValue(attribute(element, "type"));
  const method = attribute(element, "formMethod");

  const submits = isElement(element, "button")
    ? type !== "button" && type !== "reset"
    : isElement(element, "input") && (type === "submit" || type === "image");

  return submits && method !== undefined && isGetMethod(method);
}

function owningForms(
  control: ESTree.JSXOpeningElement,
  forms: readonly ESTree.JSXElement[],
): readonly ESTree.JSXElement[] {
  const target = attribute(control, "form");

  if (target !== undefined) {
    const id = stringValue(target);

    return id === null || id === ""
      ? []
      : forms.filter((form) => stringValue(attribute(form.openingElement, "id")) === id);
  }

  for (let ancestor = control.parent.parent; ancestor !== null; ancestor = ancestor.parent) {
    if (ancestor.type === "JSXElement" && isElement(ancestor.openingElement, "form")) {
      return [ancestor];
    }
  }

  return [];
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
    const forms: ESTree.JSXElement[] = [];
    const controls: ESTree.JSXOpeningElement[] = [];

    return {
      JSXElement(node) {
        if (isElement(node.openingElement, "form")) {
          forms.push(node);
        }
      },
      JSXOpeningElement(node) {
        if (isElement(node, "input") || isElement(node, "button")) {
          controls.push(node);
        }
      },
      "Program:exit"() {
        const owned = new Map<ESTree.JSXElement, ESTree.JSXOpeningElement[]>();

        for (const control of controls) {
          for (const form of owningForms(control, forms)) {
            owned.set(form, [...(owned.get(form) ?? []), control]);
          }
        }

        for (const [form, items] of owned) {
          if (
            items.some(isSecretInput) &&
            (submitsByGet(form.openingElement) || items.some(submitsByGetOverride))
          ) {
            context.report({ node: form.openingElement, messageId: "get" });
          }
        }
      },
    };
  },
});
