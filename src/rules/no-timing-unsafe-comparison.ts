import { defineRule } from "@oxlint/plugins";

import {
  isGlobal,
  referencedVariable,
  staticPropertyName,
  unwrapExpression,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const equalityOperators = new Set(["===", "!==", "==", "!="]);

const secretWords = new Set([
  "password",
  "secret",
  "token",
  "hash",
  "signature",
  "digest",
  "apikey",
]);

const word = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])/gu;

const pascalCase = /^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/u;

function isSecretName(name: string): boolean {
  if (pascalCase.test(name)) {
    return false;
  }

  const words = (name.match(word) ?? []).map((part) => part.toLowerCase());
  const last = words.at(-1);
  const beforeLast = words.at(-2);

  return (
    (last !== undefined && secretWords.has(last)) ||
    (last === "key" &&
      beforeLast !== undefined &&
      (beforeLast === "api" || secretWords.has(beforeLast)))
  );
}

function comparedName(node: ESTree.Node): string | null {
  const unwrapped = unwrapExpression(node);

  const value =
    unwrapped.type === "ChainExpression" ? unwrapExpression(unwrapped.expression) : unwrapped;

  if (value.type === "Identifier") {
    return value.name;
  }

  return value.type === "MemberExpression" ? staticPropertyName(value) : null;
}

function readonlyTarget(sourceCode: SourceCode, type: ESTree.TSType | null): ESTree.TSType | null {
  if (type?.type !== "TSTypeReference" || !isGlobal(sourceCode, type.typeName, "Readonly")) {
    return type;
  }

  const [target, ...otherArguments] = type.typeArguments?.params ?? [];

  return otherArguments.length === 0 ? (target ?? null) : null;
}

function propertyType(
  sourceCode: SourceCode,
  type: ESTree.TSType | null,
  name: string | null,
): ESTree.TSType | null {
  const objectType = readonlyTarget(sourceCode, type);

  if (objectType?.type !== "TSTypeLiteral" || name === null) {
    return null;
  }

  const property = objectType.members.find(
    (member) => member.type === "TSPropertySignature" && staticPropertyName(member) === name,
  );

  return property?.type === "TSPropertySignature"
    ? (property.typeAnnotation?.typeAnnotation ?? null)
    : null;
}

function bindingType(sourceCode: SourceCode, binding: ESTree.Node): ESTree.TSType | null {
  if (binding.type === "Identifier" && binding.typeAnnotation) {
    return binding.typeAnnotation.typeAnnotation;
  }

  const parent = binding.parent;

  if (parent?.type === "AssignmentPattern" && parent.left === binding) {
    return bindingType(sourceCode, parent);
  }

  if (parent?.type !== "Property" || parent.value !== binding) {
    return null;
  }

  const pattern = parent.parent;

  return pattern.type === "ObjectPattern"
    ? propertyType(
        sourceCode,
        pattern.typeAnnotation?.typeAnnotation ?? null,
        staticPropertyName(parent),
      )
    : null;
}

function declaredType(sourceCode: SourceCode, node: ESTree.Node): ESTree.TSType | null {
  if (
    node.type === "ParenthesizedExpression" ||
    node.type === "ChainExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TSSatisfiesExpression"
  ) {
    return declaredType(sourceCode, node.expression);
  }

  if (node.type === "TSAsExpression" || node.type === "TSTypeAssertion") {
    return node.typeAnnotation;
  }

  if (node.type === "MemberExpression") {
    return propertyType(
      sourceCode,
      declaredType(sourceCode, node.object),
      staticPropertyName(node),
    );
  }

  const [definition, ...otherDefinitions] = referencedVariable(sourceCode, node)?.defs ?? [];

  return definition !== undefined && otherDefinitions.length === 0
    ? bindingType(sourceCode, definition.name)
    : null;
}

const absentTypes = new Set(["TSUndefinedKeyword", "TSNullKeyword"]);

function isNumberType(type: ESTree.TSType | null): boolean {
  if (type === null) {
    return false;
  }

  const members = type.type === "TSUnionType" ? type.types : [type];

  return (
    members.some((member) => member.type === "TSNumberKeyword") &&
    members.every((member) => member.type === "TSNumberKeyword" || absentTypes.has(member.type))
  );
}

function isNumber(node: ESTree.Node): boolean {
  return node.type === "Literal" && typeof node.value === "number";
}

function isNonSecretValue(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const value = unwrapExpression(node);

  if (value.type === "Literal") {
    return typeof value.value !== "string" || value.value === "";
  }

  if (value.type === "TemplateLiteral") {
    return value.expressions.length === 0 && value.quasis.every((quasi) => quasi.value.raw === "");
  }

  if (value.type === "UnaryExpression") {
    return (
      ["typeof", "void"].includes(value.operator) ||
      (["-", "+"].includes(value.operator) && isNumber(unwrapExpression(value.argument)))
    );
  }

  return isGlobal(sourceCode, value, "undefined") || isNumberType(declaredType(sourceCode, node));
}

export const noTimingUnsafeComparison = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow comparing secrets with equality operators." },
    schema: [],
    messages: {
      comparison:
        "Comparing `{{name}}` with `{{operator}}` stops at the first character that differs, so response times can reveal the secret. Compare equal-length buffers with `crypto.timingSafeEqual` instead.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      BinaryExpression(node) {
        if (
          !equalityOperators.has(node.operator) ||
          isNonSecretValue(sourceCode, node.left) ||
          isNonSecretValue(sourceCode, node.right)
        ) {
          return;
        }

        const name = [comparedName(node.left), comparedName(node.right)].find(
          (candidate): candidate is string => candidate !== null && isSecretName(candidate),
        );

        if (name !== undefined) {
          context.report({
            node,
            messageId: "comparison",
            data: { name, operator: node.operator },
          });
        }
      },
    };
  },
});
