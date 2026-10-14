import { defineRule } from "@oxlint/plugins";

import { isGlobal, propertyName, unwrapExpression } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

type Check = "object" | "supporting";

type Comparison = {
  readonly left: ESTree.Node;
  readonly operator: string;
  readonly right: ESTree.Node;
};

function unwrap(node: ESTree.Node): ESTree.Node {
  const value = unwrapExpression(node);

  return value.type === "ChainExpression" ? unwrap(value.expression) : value;
}

function combined(checks: readonly (Check | null)[]): Check | null {
  if (checks.includes(null)) {
    return null;
  }

  return checks.includes("object") ? "object" : "supporting";
}

function isSubject(node: ESTree.Node, subject: string): boolean {
  const value = unwrap(node);

  return value.type === "Identifier" && value.name === subject;
}

function isLiteral(node: ESTree.Node, value: boolean | string | null): boolean {
  const literal = unwrap(node);

  return literal.type === "Literal" && literal.value === value;
}

function isUndefined(node: ESTree.Node): boolean {
  const value = unwrap(node);

  return value.type === "Identifier" && value.name === "undefined";
}

function comparedPair(
  node: Comparison,
  subject: string,
  matches: (other: ESTree.Node) => boolean,
): boolean {
  return (
    (isSubject(node.left, subject) && matches(node.right)) ||
    (isSubject(node.right, subject) && matches(node.left))
  );
}

function isTypeofSubject(node: ESTree.Node, subject: string): boolean {
  const value = unwrap(node);

  return value.type === "UnaryExpression" && value.operator === "typeof"
    ? isSubject(value.argument, subject)
    : false;
}

function typeofCheck(node: Comparison, subject: string): Check | null {
  const [typeofSide, literal] = isTypeofSubject(node.left, subject)
    ? [node.left, node.right]
    : [node.right, node.left];

  if (!isTypeofSubject(typeofSide, subject) || !["===", "=="].includes(node.operator)) {
    return null;
  }

  if (isLiteral(literal, "object")) {
    return "object";
  }

  return isLiteral(literal, "function") ? "supporting" : null;
}

function isArrayCheck(sourceCode: SourceCode, node: ESTree.Node, subject: string): boolean {
  const call = unwrap(node);

  return (
    call.type === "CallExpression" &&
    call.callee.type === "MemberExpression" &&
    propertyName(call.callee) === "isArray" &&
    isGlobal(sourceCode, call.callee.object, "Array") &&
    call.arguments.length === 1 &&
    call.arguments[0] !== undefined &&
    isSubject(call.arguments[0], subject)
  );
}

function isPrototypeRead(sourceCode: SourceCode, node: ESTree.Node, subject: string): boolean {
  const call = unwrap(node);

  return (
    call.type === "CallExpression" &&
    call.callee.type === "MemberExpression" &&
    propertyName(call.callee) === "getPrototypeOf" &&
    isGlobal(sourceCode, call.callee.object, "Object") &&
    call.arguments[0] !== undefined &&
    isSubject(call.arguments[0], subject)
  );
}

function isObjectTag(sourceCode: SourceCode, node: ESTree.Node, subject: string): boolean {
  const call = unwrap(node);

  return (
    call.type === "CallExpression" &&
    call.callee.type === "MemberExpression" &&
    propertyName(call.callee) === "call" &&
    call.arguments[0] !== undefined &&
    isSubject(call.arguments[0], subject) &&
    sourceCode.getText(call.callee.object).replace(/\s/gu, "") === "Object.prototype.toString"
  );
}

function equalityCheck(
  sourceCode: SourceCode,
  comparison: Comparison,
  subject: string,
): Check | null {
  const typeofResult = typeofCheck(comparison, subject);

  if (typeofResult !== null) {
    return typeofResult;
  }

  if (
    (isPrototypeRead(sourceCode, comparison.left, subject) &&
      (isLiteral(comparison.right, null) ||
        sourceCode.getText(comparison.right).replace(/\s/gu, "") === "Object.prototype")) ||
    (isObjectTag(sourceCode, comparison.left, subject) &&
      isLiteral(comparison.right, "[object Object]"))
  ) {
    return "object";
  }

  return null;
}

function objectCheck(sourceCode: SourceCode, node: ESTree.Node, subject: string): Check | null {
  const value = unwrap(node);

  if (value.type === "LogicalExpression" && value.operator !== "??") {
    return combined([
      objectCheck(sourceCode, value.left, subject),
      objectCheck(sourceCode, value.right, subject),
    ]);
  }

  if (value.type === "UnaryExpression" && value.operator === "!") {
    const argument = unwrap(value.argument);

    if (isArrayCheck(sourceCode, argument, subject)) {
      return "supporting";
    }

    return argument.type === "UnaryExpression" && argument.operator === "!"
      ? objectCheck(sourceCode, argument.argument, subject)
      : null;
  }

  if (isSubject(value, subject)) {
    return "supporting";
  }

  if (value.type === "CallExpression" && isGlobal(sourceCode, value.callee, "Boolean")) {
    const [argument] = value.arguments;

    return argument !== undefined && isSubject(argument, subject) ? "supporting" : null;
  }

  if (value.type !== "BinaryExpression") {
    return null;
  }

  if (value.operator === "instanceof") {
    return isSubject(value.left, subject) && isGlobal(sourceCode, value.right, "Object")
      ? "object"
      : null;
  }

  if (["!==", "!="].includes(value.operator)) {
    return comparedPair(value, subject, (other) => isLiteral(other, null) || isUndefined(other))
      ? "supporting"
      : null;
  }

  return ["===", "=="].includes(value.operator) ? equalityCheck(sourceCode, value, subject) : null;
}

function rejection(sourceCode: SourceCode, node: ESTree.Node, subject: string): Check | null {
  const value = unwrap(node);

  if (value.type === "LogicalExpression" && value.operator !== "??") {
    return combined([
      rejection(sourceCode, value.left, subject),
      rejection(sourceCode, value.right, subject),
    ]);
  }

  if (value.type === "UnaryExpression" && value.operator === "!") {
    return objectCheck(sourceCode, value.argument, subject);
  }

  if (isArrayCheck(sourceCode, value, subject)) {
    return "supporting";
  }

  if (value.type !== "BinaryExpression") {
    return null;
  }

  if (["===", "=="].includes(value.operator)) {
    return comparedPair(value, subject, (other) => isLiteral(other, null) || isUndefined(other))
      ? "supporting"
      : null;
  }

  return ["!==", "!="].includes(value.operator)
    ? equalityCheck(sourceCode, { left: value.left, operator: "===", right: value.right }, subject)
    : null;
}

function isNamedHelper(fn: FunctionNode): boolean {
  const holder = fn.parent;

  return (
    fn.type === "FunctionDeclaration" ||
    (holder.type === "VariableDeclarator" && holder.init === fn) ||
    (holder.type === "Property" && holder.value === fn) ||
    (holder.type === "PropertyDefinition" && holder.value === fn) ||
    holder.type === "MethodDefinition"
  );
}

const openTypes = new Set(["TSUnknownKeyword", "TSAnyKeyword"]);

const weakClaims = new Set(["TSObjectKeyword", "TSUnknownKeyword", "TSAnyKeyword"]);

function unprovenClaim(
  sourceCode: SourceCode,
  fn: FunctionNode,
  parameter: ESTree.BindingIdentifier,
): string | null {
  const predicate = fn.returnType?.typeAnnotation;
  const parameterType = parameter.typeAnnotation?.typeAnnotation;

  if (
    predicate?.type !== "TSTypePredicate" ||
    predicate.parameterName.type !== "Identifier" ||
    predicate.parameterName.name !== parameter.name ||
    predicate.typeAnnotation === null ||
    parameterType === undefined ||
    !openTypes.has(parameterType.type)
  ) {
    return null;
  }

  const claim = predicate.typeAnnotation.typeAnnotation;

  if (
    weakClaims.has(claim.type) ||
    (claim.type === "TSTypeLiteral" && claim.members.length === 0) ||
    (claim.type === "TSTypeReference" &&
      claim.typeName.type === "Identifier" &&
      claim.typeName.name === "NonNullable")
  ) {
    return null;
  }

  return sourceCode.getText(claim);
}

function returnedCheck(sourceCode: SourceCode, node: ESTree.Node, subject: string): Check | null {
  return isLiteral(node, true) ? "supporting" : objectCheck(sourceCode, node, subject);
}

function rejectedCheck(
  sourceCode: SourceCode,
  statement: ESTree.Statement,
  subject: string,
): Check | null {
  if (statement.type !== "IfStatement" || statement.alternate !== null) {
    return null;
  }

  const consequent = statement.consequent;

  const exit =
    consequent.type === "BlockStatement" && consequent.body.length === 1
      ? consequent.body[0]
      : consequent;

  return exit?.type === "ReturnStatement" &&
    exit.argument !== null &&
    isLiteral(exit.argument, false)
    ? rejection(sourceCode, statement.test, subject)
    : null;
}

function guardProof(sourceCode: SourceCode, fn: FunctionNode, subject: string): Check | null {
  if (fn.body === null) {
    return null;
  }

  if (fn.body.type !== "BlockStatement") {
    return returnedCheck(sourceCode, fn.body, subject);
  }

  const statements = fn.body.body;
  const last = statements.at(-1);

  if (last?.type !== "ReturnStatement" || last.argument === null) {
    return null;
  }

  return combined([
    ...statements.slice(0, -1).map((statement) => rejectedCheck(sourceCode, statement, subject)),
    returnedCheck(sourceCode, last.argument, subject),
  ]);
}

export const noGenericObjectGuard = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow guards such as isRecord that only prove a value is a non-null object, and guards that claim a type they never check.",
    },
    schema: [],
    messages: {
      unproven:
        "This guard claims `{{subject}}` is `{{claim}}` but only checks that it exists. Check the fields the type promises, or parse the value with a schema.",
      guard:
        "This guard only proves `{{subject}}` is an object, which says nothing about its fields. Parse the value with a schema where it enters, or narrow inline where only its object-ness matters.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function check(fn: FunctionNode): void {
      const [parameter, ...rest] = fn.params;

      if (parameter?.type !== "Identifier" || rest.length > 0) {
        return;
      }

      const proof = guardProof(sourceCode, fn, parameter.name);

      if (proof === "object" && isNamedHelper(fn)) {
        context.report({ node: fn, messageId: "guard", data: { subject: parameter.name } });

        return;
      }

      const claim = unprovenClaim(sourceCode, fn, parameter);

      if (claim !== null && proof === "supporting") {
        context.report({
          node: fn,
          messageId: "unproven",
          data: { subject: parameter.name, claim },
        });
      }
    }

    return {
      ArrowFunctionExpression: check,
      FunctionDeclaration: check,
      FunctionExpression: check,
    };
  },
});
