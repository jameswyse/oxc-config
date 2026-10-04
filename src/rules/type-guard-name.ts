import { defineRule } from "@oxlint/plugins";

import { propertyName } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

type PredicateName = {
  node: ESTree.Node;
  name: string | null;
};

function predicateName(node: ESTree.TSTypePredicate): PredicateName | null {
  const owner = node.parent.parent;

  if (!owner) {
    return null;
  }

  if (owner.type === "TSMethodSignature") {
    return owner.computed ? null : { node: owner.key, name: propertyName(owner) };
  }

  const parent =
    owner.type === "TSFunctionType" && owner.parent.type === "TSTypeAnnotation"
      ? owner.parent.parent
      : owner.parent;

  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") {
    return { node: parent.id, name: parent.id.name };
  }

  if (
    parent?.type === "Identifier" &&
    parent.parent.type === "VariableDeclarator" &&
    parent.parent.id === parent
  ) {
    return { node: parent, name: parent.name };
  }

  if (
    parent?.type === "Property" ||
    parent?.type === "MethodDefinition" ||
    parent?.type === "PropertyDefinition" ||
    parent?.type === "TSPropertySignature"
  ) {
    return parent.computed ? null : { node: parent.key, name: propertyName(parent) };
  }

  if ("id" in owner && owner.id?.type === "Identifier") {
    return { node: owner.id, name: owner.id.name };
  }

  return null;
}

export const typeGuardName = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Name type predicates with an is or has prefix." },
    schema: [],
    messages: {
      name: "Name the type predicate '{{name}}' with an is or has prefix, such as isValue or hasValue.",
    },
  },
  create(context) {
    const reported = new WeakSet<ESTree.Node>();

    return {
      TSTypePredicate(node) {
        if (node.asserts) {
          return;
        }

        const named = predicateName(node);

        if (
          named?.name &&
          !reported.has(named.node) &&
          !/^(?:is|has)(?:\p{Lu}|\p{N}|_)/u.test(named.name)
        ) {
          reported.add(named.node);
          context.report({ node: named.node, messageId: "name", data: { name: named.name } });
        }
      },
    };
  },
});
