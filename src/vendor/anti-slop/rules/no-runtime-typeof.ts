// Adapted from dmmulroy/anti-slop
import { defineRule } from "@oxlint/plugins";

import { variableFor } from "../../../shared/index.ts";
import {
  createTypeAliasEnvironment,
  resolvedTypeMatches,
} from "../shared/type-alias-resolution.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

import type { TypeAliasEnvironment } from "../shared/type-alias-resolution.ts";

type RuntimeFunction = ESTree.ArrowFunctionExpression | ESTree.Function;

function isRuntimeFunction(node: ESTree.Node): node is RuntimeFunction {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression"
  );
}

function isInsideTypeGuard(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent;

  while (current !== null && current.type !== "Program") {
    if (isRuntimeFunction(current)) {
      return current.returnType?.typeAnnotation.type === "TSTypePredicate";
    }

    current = current.parent;
  }

  return false;
}

function isExistenceProbe(node: ESTree.UnaryExpression): boolean {
  const parent = node.parent;

  if (parent.type !== "BinaryExpression") {
    return false;
  }

  if (!["===", "!==", "==", "!="].includes(parent.operator)) {
    return false;
  }

  const other = parent.left === node ? parent.right : parent.left;

  return other.type === "Literal" && other.value === "undefined";
}

function declaredType(sourceCode: SourceCode, node: ESTree.Node): ESTree.TSType | null {
  const name = variableFor(sourceCode, node)?.defs[0]?.name;

  return name?.type === "Identifier" ? (name.typeAnnotation?.typeAnnotation ?? null) : null;
}

function isUnion(type: ESTree.TSType, environment: TypeAliasEnvironment): boolean {
  return resolvedTypeMatches(type, environment, (resolved, matches) =>
    resolved.type === "TSParenthesizedType"
      ? matches(resolved.typeAnnotation)
      : resolved.type === "TSUnionType",
  );
}

function isOpen(type: ESTree.TSType, environment: TypeAliasEnvironment): boolean {
  return resolvedTypeMatches(
    type,
    environment,
    (resolved, matches) =>
      resolved.type === "TSUnknownKeyword" ||
      resolved.type === "TSAnyKeyword" ||
      (resolved.type === "TSParenthesizedType" && matches(resolved.typeAnnotation)) ||
      (resolved.type === "TSUnionType" && resolved.types.some(matches)),
  );
}

function isKnownUnion(type: ESTree.TSType, environment: TypeAliasEnvironment): boolean {
  return isUnion(type, environment) && !isOpen(type, environment);
}

export const noRuntimeTypeof = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow runtime typeof checks; external values must be decoded into meaningful types at their I/O boundary.",
    },
    messages: {
      runtimeTypeof:
        "A `typeof` check narrows a value's representation without proving its shape. Parse input where it enters, then branch on the domain value.",
    },
    schema: [
      {
        type: "object",
        properties: { allowInTypeGuards: { type: "boolean" } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ allowInTypeGuards: false }],
  },
  createOnce(context) {
    let environment: TypeAliasEnvironment | null = null;

    function discriminatesKnownUnion(node: ESTree.UnaryExpression): boolean {
      const type = declaredType(context.sourceCode, node.argument);

      return type !== null && environment !== null && isKnownUnion(type, environment);
    }

    return {
      Program(program) {
        environment = createTypeAliasEnvironment(program, context.sourceCode.visitorKeys);
      },
      UnaryExpression(node) {
        const option = context.options[0];

        const allowInTypeGuards =
          typeof option === "object" &&
          option !== null &&
          !Array.isArray(option) &&
          option.allowInTypeGuards === true;

        if (
          node.operator === "typeof" &&
          !isExistenceProbe(node) &&
          !discriminatesKnownUnion(node) &&
          (!allowInTypeGuards || !isInsideTypeGuard(node))
        ) {
          context.report({ node, messageId: "runtimeTypeof" });
        }
      },
    };
  },
});
