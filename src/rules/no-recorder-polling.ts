import { defineRule } from "@oxlint/plugins";

import {
  apiReference,
  importedBinding,
  isFunctionNode,
  isGlobal,
  isTestRunner,
  staticPropertyName,
  testModules,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, Reference, SourceCode } from "@oxlint/plugins";

type PollKind = "expect.poll" | "waitFor";

const spyMatcher =
  /^(?:toHaveBeen(?:Last|Nth)?Called|toBeCalled|lastCalledWith|nthCalledWith|toReturn|toHave(?:Last|Nth)?(?:Returned|Resolved))/u;

const viModules = ["vitest", "@effect/vitest"];

const collectionConstructors = new Set(["Array", "Set", "Map"]);

const recordingMethods = new Set(["push", "unshift", "add", "set"]);

const comparisonOperators = new Set([">", ">=", "<", "<=", "===", "!==", "==", "!="]);

function isExpect(sourceCode: SourceCode, node: ESTree.Node) {
  const api = apiReference(sourceCode, node);

  return api?.name === "expect" && (testModules.has(api.module) || api.module === "global");
}

function pollKind(sourceCode: SourceCode, callee: ESTree.Node) {
  const value = unwrapExpression(callee);

  const method = value.type === "MemberExpression" ? staticPropertyName(value) : null;

  if (
    value.type === "MemberExpression" &&
    method === "poll" &&
    isExpect(sourceCode, value.object)
  ) {
    return "expect.poll";
  }

  if (
    value.type === "MemberExpression" &&
    method === "waitFor" &&
    isTestRunner(sourceCode, value.object, "vi", viModules)
  ) {
    return "waitFor";
  }

  const binding = importedBinding(sourceCode, value);

  return binding?.source.startsWith("@testing-library/") && binding.name === "waitFor"
    ? "waitFor"
    : null;
}

function polledExpressions(callback: ESTree.Node | undefined) {
  const fn = callback === undefined ? null : unwrapExpression(callback);

  if (fn === null || !isFunctionNode(fn) || fn.body === null) {
    return [];
  }

  if (fn.body.type !== "BlockStatement") {
    return [unwrapExpression(fn.body)];
  }

  const statements = fn.body.body;
  const [statement, ...rest] = statements;

  if (statement?.type === "ReturnStatement" && rest.length === 0) {
    return statement.argument === null ? [] : [unwrapExpression(statement.argument)];
  }

  const expressions = statements.flatMap((each) =>
    each.type === "ExpressionStatement" ? [unwrapExpression(each.expression)] : [],
  );

  return expressions.length === statements.length ? expressions : [];
}

function memberPath(node: ESTree.Node): string[] | null {
  const unwrapped = unwrapExpression(node);
  const value = unwrapped.type === "ChainExpression" ? unwrapped.expression : unwrapped;

  if (value.type === "Identifier") {
    return [];
  }

  if (value.type !== "MemberExpression") {
    return null;
  }

  const path = memberPath(value.object);

  return path === null ? null : [...path, staticPropertyName(value) ?? ""];
}

function readablePath(node: ESTree.Node) {
  const path = memberPath(node);

  return path === null || path.includes("current") ? null : path;
}

function isCollectionLiteral(sourceCode: SourceCode, node: ESTree.Expression | null) {
  const value = node === null ? null : unwrapExpression(node);

  if (value?.type === "ArrayExpression") {
    return true;
  }

  const callee = value?.type === "NewExpression" ? unwrapExpression(value.callee) : null;

  return (
    callee?.type === "Identifier" &&
    collectionConstructors.has(callee.name) &&
    isGlobal(sourceCode, callee, callee.name)
  );
}

function isRecordingCall(reference: Reference) {
  const member = reference.identifier.parent;

  return (
    member.type === "MemberExpression" &&
    member.object === reference.identifier &&
    recordingMethods.has(staticPropertyName(member) ?? "") &&
    member.parent.type === "CallExpression" &&
    member.parent.callee === member
  );
}

function isRecorderCollection(sourceCode: SourceCode, node: ESTree.Node) {
  const variable = variableFor(sourceCode, unwrapExpression(node));
  const [definition, ...otherDefinitions] = variable?.defs ?? [];
  const declarator = definition?.node;
  const declaration = declarator?.parent;

  return (
    variable !== null &&
    otherDefinitions.length === 0 &&
    definition?.type === "Variable" &&
    declarator?.type === "VariableDeclarator" &&
    declarator.id === definition.name &&
    declaration?.type === "VariableDeclaration" &&
    ["const", "let"].includes(declaration.kind) &&
    isCollectionLiteral(sourceCode, declarator.init) &&
    variable.references.some(
      (reference) =>
        reference.from.variableScope !== variable.scope.variableScope && isRecordingCall(reference),
    )
  );
}

function isSpyRecord(node: ESTree.Node) {
  return readablePath(node)?.includes("mock") ?? false;
}

function readsRecorderSize(sourceCode: SourceCode, node: ESTree.Node) {
  const unwrapped = unwrapExpression(node);
  const value = unwrapped.type === "ChainExpression" ? unwrapped.expression : unwrapped;

  return (
    isSpyRecord(value) ||
    (value.type === "MemberExpression" &&
      ["length", "size"].includes(staticPropertyName(value) ?? "") &&
      isRecorderCollection(sourceCode, value.object))
  );
}

function comparedValues(sourceCode: SourceCode, node: ESTree.Node): ESTree.Node[] {
  const value = unwrapExpression(node);

  if (value.type === "UnaryExpression" && value.operator === "!") {
    return comparedValues(sourceCode, value.argument);
  }

  if (value.type === "BinaryExpression" && comparisonOperators.has(value.operator)) {
    return [...comparedValues(sourceCode, value.left), ...comparedValues(sourceCode, value.right)];
  }

  const [argument, ...rest] = value.type === "CallExpression" ? value.arguments : [];

  return value.type === "CallExpression" &&
    isGlobal(sourceCode, value.callee, "Boolean") &&
    argument !== undefined &&
    argument.type !== "SpreadElement" &&
    rest.length === 0
    ? comparedValues(sourceCode, argument)
    : [value];
}

function isLiteralValue(node: ESTree.Node) {
  const value = unwrapExpression(node);

  return (
    value.type === "Literal" ||
    (value.type === "UnaryExpression" &&
      value.operator === "-" &&
      unwrapExpression(value.argument).type === "Literal")
  );
}

function isUndefinedValue(sourceCode: SourceCode, node: ESTree.Node) {
  const value = unwrapExpression(node);

  return (
    isGlobal(sourceCode, value, "undefined") ||
    (value.type === "UnaryExpression" &&
      value.operator === "void" &&
      unwrapExpression(value.argument).type === "Literal")
  );
}

function isConstant(sourceCode: SourceCode, node: ESTree.Node) {
  if (isLiteralValue(node) || isUndefinedValue(sourceCode, node)) {
    return true;
  }

  const variable = variableFor(sourceCode, unwrapExpression(node));
  const [definition, ...otherDefinitions] = variable?.defs ?? [];
  const declarator = definition?.node;

  return (
    otherDefinitions.length === 0 &&
    declarator?.type === "VariableDeclarator" &&
    declarator.id === definition?.name &&
    declarator.parent.type === "VariableDeclaration" &&
    declarator.parent.kind === "const" &&
    declarator.init !== null &&
    isLiteralValue(declarator.init)
  );
}

function readsRecorderState(sourceCode: SourceCode, node: ESTree.Node) {
  const values = comparedValues(sourceCode, node);
  const isRecorder = (value: ESTree.Node) => readsRecorderSize(sourceCode, value);

  return (
    values.some(isRecorder) &&
    values.every((value) => isRecorder(value) || isConstant(sourceCode, value))
  );
}

function matcherAssertsRecorder(sourceCode: SourceCode, matcher: string, subject: ESTree.Node) {
  if (matcher === "toHaveLength") {
    return isSpyRecord(subject) || isRecorderCollection(sourceCode, subject);
  }

  return spyMatcher.test(matcher) && readablePath(subject) !== null;
}

function matcherChain(node: ESTree.Node) {
  const assertion = unwrapExpression(node.type === "AwaitExpression" ? node.argument : node);

  if (assertion.type !== "CallExpression") {
    return null;
  }

  const callee = unwrapExpression(assertion.callee);
  const matcher = callee.type === "MemberExpression" ? staticPropertyName(callee) : null;

  if (callee.type !== "MemberExpression" || matcher === null) {
    return null;
  }

  const modified = unwrapExpression(callee.object);

  const subject =
    modified.type === "MemberExpression" && staticPropertyName(modified) === "not"
      ? unwrapExpression(modified.object)
      : modified;

  return { matcher, subject };
}

function expectedValue(sourceCode: SourceCode, node: ESTree.Node) {
  if (node.type !== "CallExpression" || !isExpect(sourceCode, node.callee)) {
    return null;
  }

  const [actual] = node.arguments;

  return actual === undefined || actual.type === "SpreadElement" ? null : actual;
}

function assertsRecorder(sourceCode: SourceCode, polled: ESTree.Node) {
  const chain = matcherChain(polled);
  const actual = chain === null ? null : expectedValue(sourceCode, chain.subject);

  if (chain === null || actual === null) {
    return false;
  }

  return (
    readsRecorderState(sourceCode, actual) ||
    matcherAssertsRecorder(sourceCode, chain.matcher, actual)
  );
}

function chainedMatcher(poll: ESTree.CallExpression) {
  const member = poll.parent;

  const name =
    member.type === "MemberExpression" && member.object === poll
      ? staticPropertyName(member)
      : null;

  if (name !== "not" || member.type !== "MemberExpression") {
    return name;
  }

  const next = member.parent;

  return next.type === "MemberExpression" && next.object === member
    ? staticPropertyName(next)
    : null;
}

function readsRecorder(sourceCode: SourceCode, kind: PollKind, poll: ESTree.CallExpression) {
  const polled = polledExpressions(poll.arguments[0]);
  const matcher = kind === "expect.poll" ? chainedMatcher(poll) : null;

  return (
    polled.length > 0 &&
    polled.every(
      (expression) =>
        readsRecorderState(sourceCode, expression) ||
        (kind === "waitFor"
          ? assertsRecorder(sourceCode, expression)
          : matcher !== null && matcherAssertsRecorder(sourceCode, matcher, expression)),
    )
  );
}

export const noRecorderPolling = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow polling a request log or spy until a deadline." },
    schema: [],
    messages: {
      poll: "Await a signal instead: resolve a `Promise.withResolvers()` deferred from the handler or callback that records the call and await its promise, or await the operation itself.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const kind = pollKind(sourceCode, node.callee);

        if (kind !== null && readsRecorder(sourceCode, kind, node)) {
          context.report({ node, messageId: "poll" });
        }
      },
    };
  },
});
