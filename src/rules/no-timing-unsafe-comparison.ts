import { defineRule } from "@oxlint/plugins";

import {
  childNodes,
  isGlobal,
  staticPropertyName,
  staticString,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, Reference, SourceCode, Variable } from "@oxlint/plugins";

const equalityOperators = new Set(["===", "!==", "==", "!="]);

const secretWords = new Set([
  "password",
  "secret",
  "token",
  "signature",
  "hash",
  "digest",
  "apikey",
]);

const highEntropySecretWords = new Set(["session", "token", "key"]);

const confirmationWords = new Set([
  "confirm",
  "confirmation",
  "confirmed",
  "repeat",
  "repeated",
  "retype",
  "retyped",
]);

const word = /[A-Z]?[a-z]+|[A-Z]+(?![a-z])/gu;

const pascalCase = /^[A-Z](?=[A-Za-z0-9]*[a-z])[A-Za-z0-9]*$/u;

function nameWords(name: string) {
  return (name.match(word) ?? []).map((part) => part.toLowerCase());
}

function isSecretName(name: string) {
  if (pascalCase.test(name)) {
    return false;
  }

  const words = nameWords(name);
  const last = words.at(-1);
  const beforeLast = words.at(-2);

  return (
    (last !== undefined &&
      secretWords.has(last) &&
      !(last === "hash" && beforeLast !== undefined && highEntropySecretWords.has(beforeLast))) ||
    (last === "key" &&
      beforeLast !== undefined &&
      (beforeLast === "api" || secretWords.has(beforeLast)))
  );
}

function isConfirmationName(name: string) {
  const words = nameWords(name);

  return (
    words.some((part) => confirmationWords.has(part)) &&
    words.every((part) => part === "password" || !secretWords.has(part))
  );
}

function comparedValue(node: ESTree.Node) {
  const unwrapped = unwrapExpression(node);

  return unwrapped.type === "ChainExpression" ? unwrapExpression(unwrapped.expression) : unwrapped;
}

function comparedName(node: ESTree.Node) {
  const value = comparedValue(node);

  if (value.type === "Identifier") {
    return value.name;
  }

  return value.type === "MemberExpression" ? staticPropertyName(value) : null;
}

function singleStringArgument(node: ESTree.Node) {
  const value = comparedValue(node);

  return value.type === "CallExpression" && value.arguments.length === 1
    ? staticString(value.arguments[0])
    : null;
}

function isConfirmationValue(node: ESTree.Node) {
  const name = comparedName(node) ?? singleStringArgument(node);

  return name !== null && isConfirmationName(name);
}

function isPasswordValue(node: ESTree.Node) {
  const name = comparedName(node);

  return name !== null && nameWords(name).at(-1) === "password";
}

function isPasswordConfirmation(left: ESTree.Node, right: ESTree.Node) {
  return (
    (isConfirmationValue(left) && isPasswordValue(right)) ||
    (isConfirmationValue(right) && isPasswordValue(left))
  );
}

function readonlyTarget(sourceCode: SourceCode, type: ESTree.TSType | null) {
  if (type?.type !== "TSTypeReference" || !isGlobal(sourceCode, type.typeName, "Readonly")) {
    return type;
  }

  const [target, ...otherArguments] = type.typeArguments?.params ?? [];

  return otherArguments.length === 0 ? (target ?? null) : null;
}

function propertyType(sourceCode: SourceCode, type: ESTree.TSType | null, name: string | null) {
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

function bindingType(sourceCode: SourceCode, binding: ESTree.Node) {
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

function containsCast(node: ESTree.Node, visitorKeys: SourceCode["visitorKeys"]): boolean {
  return (
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    childNodes(node, visitorKeys).some((child) => containsCast(child, visitorKeys))
  );
}

const targetParts = new Set([
  "ArrayPattern",
  "ObjectPattern",
  "ParenthesizedExpression",
  "RestElement",
  "TSAsExpression",
  "TSNonNullExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

function isTargetPart(node: ESTree.Node, parent: ESTree.Node) {
  if (parent.type === "MemberExpression") {
    return parent.object === node;
  }

  if (parent.type === "AssignmentPattern") {
    return parent.left === node;
  }

  return parent.type === "Property"
    ? parent.value === node && parent.parent.type === "ObjectPattern"
    : targetParts.has(parent.type);
}

function assignmentTarget(node: ESTree.Node): ESTree.Node {
  const parent = node.parent;

  return parent !== null && isTargetPart(node, parent) ? assignmentTarget(parent) : node;
}

function writtenValue(reference: Reference, target: ESTree.Node) {
  if (reference.isWrite()) {
    return reference.writeExpr;
  }

  const parent = target.parent;

  return parent?.type === "AssignmentExpression" && parent.left === target ? parent.right : null;
}

function writesCast(reference: Reference, visitorKeys: SourceCode["visitorKeys"]) {
  const target = assignmentTarget(reference.identifier);
  const value = writtenValue(reference, target);

  return value !== null && (containsCast(target, visitorKeys) || containsCast(value, visitorKeys));
}

const castWrites = new WeakMap<Variable, boolean>();

function hasCastWrite(sourceCode: SourceCode, variable: Variable) {
  let result = castWrites.get(variable);

  if (result === undefined) {
    result = variable.references.some((reference) => writesCast(reference, sourceCode.visitorKeys));
    castWrites.set(variable, result);
  }

  return result;
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

  if (node.type === "MemberExpression") {
    return propertyType(
      sourceCode,
      declaredType(sourceCode, node.object),
      staticPropertyName(node),
    );
  }

  const variable = variableFor(sourceCode, node);
  const [definition, ...otherDefinitions] = variable?.defs ?? [];

  if (variable === null || definition === undefined || otherDefinitions.length > 0) {
    return null;
  }

  const type = bindingType(sourceCode, definition.name);

  return type === null || hasCastWrite(sourceCode, variable) ? null : type;
}

const absentTypes = new Set(["TSUndefinedKeyword", "TSNullKeyword"]);

function isNumberType(type: ESTree.TSType | null) {
  if (type === null) {
    return false;
  }

  const members = type.type === "TSUnionType" ? type.types : [type];

  return (
    members.some((member) => member.type === "TSNumberKeyword") &&
    members.every((member) => member.type === "TSNumberKeyword" || absentTypes.has(member.type))
  );
}

function isNumber(node: ESTree.Node) {
  return node.type === "Literal" && typeof node.value === "number";
}

function isNonSecretValue(sourceCode: SourceCode, node: ESTree.Node) {
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
          isNonSecretValue(sourceCode, node.right) ||
          isPasswordConfirmation(node.left, node.right)
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
