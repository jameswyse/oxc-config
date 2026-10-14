import { defineRule } from "@oxlint/plugins";

import {
  childNodes,
  isEffectNamespace,
  isGlobal,
  propertyName,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const nestedScopes = new Set([
  "ArrowFunctionExpression",
  "FunctionExpression",
  "FunctionDeclaration",
  "ClassBody",
]);

const parserFunctions = ["decodeURIComponent", "decodeURI", "atob", "BigInt", "structuredClone"];

const parserConstructors = ["URL", "RegExp"];

const fileSystemModules = new Set(["node:fs", "fs", "node:fs/promises", "fs/promises"]);

function unwrap(node: ESTree.Expression | null): ESTree.Expression | null {
  if (
    node?.type === "TSAsExpression" ||
    node?.type === "TSSatisfiesExpression" ||
    node?.type === "TSNonNullExpression"
  ) {
    return unwrap(node.expression);
  }

  return node;
}

function isFallback(sourceCode: SourceCode, node: ESTree.Expression | null): boolean {
  const value = unwrap(node);

  if (value === null) {
    return true;
  }

  if (value.type === "Literal") {
    return (
      !("regex" in value) && !("bigint" in value) && [null, false, "", 0].includes(value.value)
    );
  }

  if (value.type === "Identifier") {
    return isGlobal(sourceCode, value, "undefined");
  }

  if (value.type === "UnaryExpression") {
    return value.operator === "void" && value.argument.type === "Literal";
  }

  if (value.type === "ArrayExpression") {
    return value.elements.length === 0;
  }

  if (value.type === "ObjectExpression") {
    return value.properties.length === 0;
  }

  return (
    value.type === "TemplateLiteral" &&
    value.expressions.length === 0 &&
    value.quasis[0]?.value.cooked === ""
  );
}

function returnsFallback(
  sourceCode: SourceCode,
  statements: readonly (ESTree.Directive | ESTree.Statement)[],
): boolean {
  const [statement] = statements;

  return (
    statements.length === 1 &&
    statement?.type === "ReturnStatement" &&
    isFallback(sourceCode, statement.argument)
  );
}

function descendants(sourceCode: SourceCode, root: ESTree.Node): ESTree.Node[] {
  const found: ESTree.Node[] = [];
  const pending = [root];

  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    found.push(node);

    if (node === root || !nestedScopes.has(node.type)) {
      pending.push(...childNodes(node, sourceCode.visitorKeys));
    }
  }

  return found;
}

function isFileSystemModule(sourceCode: SourceCode, identifier: ESTree.Expression): boolean {
  if (identifier.type !== "Identifier") {
    return false;
  }

  const definition = variableFor(sourceCode, identifier)?.defs[0];

  return (
    definition?.type === "ImportBinding" &&
    definition.parent?.type === "ImportDeclaration" &&
    fileSystemModules.has(definition.parent.source.value)
  );
}

function isFileSystemCall(sourceCode: SourceCode, callee: ESTree.Expression): boolean {
  if (callee.type === "Identifier") {
    return isFileSystemModule(sourceCode, callee);
  }

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const object = callee.object;

  return (
    isFileSystemModule(sourceCode, object) ||
    (object.type === "MemberExpression" &&
      propertyName(object) === "promises" &&
      isFileSystemModule(sourceCode, object.object))
  );
}

function isParser(
  sourceCode: SourceCode,
  node: ESTree.CallExpression | ESTree.NewExpression,
): boolean {
  const callee = node.callee;

  if (node.type === "NewExpression") {
    return (
      parserConstructors.some((name) => isGlobal(sourceCode, callee, name)) ||
      (callee.type === "MemberExpression" && isGlobal(sourceCode, callee.object, "Intl"))
    );
  }

  if (parserFunctions.some((name) => isGlobal(sourceCode, callee, name))) {
    return true;
  }

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const name = propertyName(callee);

  return (
    (name === "parse" && isGlobal(sourceCode, callee.object, "JSON")) ||
    (name === "json" && node.arguments.length === 0)
  );
}

function isProbe(sourceCode: SourceCode, node: ESTree.Node): boolean {
  return (
    (node.type === "CallExpression" || node.type === "NewExpression") &&
    (isParser(sourceCode, node) || isFileSystemCall(sourceCode, node.callee))
  );
}

function containsProbe(sourceCode: SourceCode, node: ESTree.Node): boolean {
  return descendants(sourceCode, node).some((descendant) => isProbe(sourceCode, descendant));
}

function onlyProbes(sourceCode: SourceCode, block: ESTree.BlockStatement): boolean {
  const nodes = descendants(sourceCode, block);

  return (
    nodes.some((node) => isProbe(sourceCode, node)) &&
    nodes.every(
      (node) =>
        (node.type !== "AwaitExpression" && node.type !== "YieldExpression") ||
        (node.argument !== null && containsProbe(sourceCode, node.argument)),
    )
  );
}

function isSharedBinding(sourceCode: SourceCode, node: ESTree.IdentifierReference): boolean {
  const variable = variableFor(sourceCode, node);

  return (
    variable === null ||
    variable.defs.some((definition) => definition.type !== "Variable") ||
    variable.references.filter((reference) => reference.isRead()).length > 1
  );
}

function isExistingPromise(sourceCode: SourceCode, node: ESTree.Expression): boolean {
  const value = node.type === "ChainExpression" ? node.expression : node;

  if (
    value.type === "CallExpression" &&
    value.callee.type === "MemberExpression" &&
    propertyName(value.callee) === "finally"
  ) {
    return isExistingPromise(sourceCode, value.callee.object);
  }

  return (
    (value.type === "Identifier" && isSharedBinding(sourceCode, value)) ||
    value.type === "MemberExpression"
  );
}

function swallowingCallback(sourceCode: SourceCode, callback: ESTree.Argument): boolean {
  if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") {
    return false;
  }

  const body = callback.body;

  if (body === null || body.type !== "BlockStatement") {
    return isFallback(sourceCode, body);
  }

  return body.body.length === 0 || returnsFallback(sourceCode, body.body);
}

function rejectionHandler(
  node: ESTree.CallExpression,
): { promise: ESTree.Expression; handler: ESTree.Argument } | null {
  if (node.callee.type !== "MemberExpression") {
    return null;
  }

  const name = propertyName(node.callee);
  const [onFulfilled, onRejected, ...extraArguments] = node.arguments;

  const handler =
    name === "catch" && onRejected === undefined
      ? onFulfilled
      : name === "then" && extraArguments.length === 0
        ? onRejected
        : undefined;

  return handler === undefined ? null : { promise: node.callee.object, handler };
}

const effectRecoveries = new Set(["catchAll", "catchAllCause", "orElse"]);

function effectMember(sourceCode: SourceCode, node: ESTree.Node): string | null {
  return node.type === "MemberExpression" && isEffectNamespace(sourceCode, node.object)
    ? propertyName(node)
    : null;
}

function isEffectFallback(sourceCode: SourceCode, node: ESTree.Expression | null): boolean {
  const value = unwrap(node);

  if (value === null) {
    return false;
  }

  const member = effectMember(sourceCode, value);

  if (member === "void" || member === "succeedNone") {
    return true;
  }

  if (value.type !== "CallExpression" || effectMember(sourceCode, value.callee) !== "succeed") {
    return false;
  }

  const [result] = value.arguments;

  return (
    result === undefined || (result.type !== "SpreadElement" && isFallback(sourceCode, result))
  );
}

function returnedValue(callback: ESTree.Argument): ESTree.Expression | null | undefined {
  if (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression") {
    return undefined;
  }

  const body = callback.body;

  if (body === null) {
    return undefined;
  }

  if (body.type !== "BlockStatement") {
    return body;
  }

  const [statement] = body.body;

  return body.body.length === 1 && statement?.type === "ReturnStatement"
    ? statement.argument
    : undefined;
}

function swallowingEffectRecovery(
  sourceCode: SourceCode,
  node: ESTree.CallExpression,
): ESTree.Argument | null {
  const name = effectMember(sourceCode, node.callee);
  const handler = node.arguments.at(-1);

  if (name === null || handler === undefined) {
    return null;
  }

  const value = returnedValue(handler);

  if (value === undefined) {
    return null;
  }

  if (name === "orElseSucceed") {
    return isFallback(sourceCode, value) ? handler : null;
  }

  return effectRecoveries.has(name) && isEffectFallback(sourceCode, value) ? handler : null;
}

function settlement(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
): ESTree.CallExpression | null {
  let value = expression;

  while (
    value.type === "AwaitExpression" ||
    (value.type === "UnaryExpression" && value.operator === "void")
  ) {
    value = value.argument;
  }

  return value.type === "CallExpression" &&
    value.callee.type === "MemberExpression" &&
    propertyName(value.callee) === "allSettled" &&
    isGlobal(sourceCode, value.callee.object, "Promise")
    ? value
    : null;
}

export const noSwallowedErrors = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Disallow error handlers that discard the error and return a fallback, and unread settled results.",
    },
    schema: [],
    messages: {
      swallowed:
        "This handler discards the error and returns a fallback, so callers cannot tell failure from an empty result. Prevent the failure, let it propagate, or return a failure the caller must handle.",
      settled:
        "These settled results are never read, so every rejection disappears. Handle the rejected results, or use `Promise.all` so failures propagate.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      TryStatement(node) {
        const handler = node.handler;

        if (
          handler !== null &&
          returnsFallback(sourceCode, handler.body.body) &&
          !onlyProbes(sourceCode, node.block)
        ) {
          context.report({ node: handler, messageId: "swallowed" });
        }
      },
      CallExpression(node) {
        const rejection = rejectionHandler(node);

        if (
          rejection !== null &&
          !isExistingPromise(sourceCode, rejection.promise) &&
          !isProbe(sourceCode, rejection.promise) &&
          swallowingCallback(sourceCode, rejection.handler)
        ) {
          context.report({ node: rejection.handler, messageId: "swallowed" });
        }

        const recovery = swallowingEffectRecovery(sourceCode, node);

        if (recovery !== null) {
          context.report({ node: recovery, messageId: "swallowed" });
        }
      },
      ExpressionStatement(node) {
        const discarded = settlement(sourceCode, node.expression);

        if (discarded !== null) {
          context.report({ node: discarded, messageId: "settled" });
        }
      },
      VariableDeclarator(node) {
        const unread =
          node.init === null || node.parent.parent?.type === "ExportNamedDeclaration"
            ? null
            : settlement(sourceCode, node.init);

        if (
          unread !== null &&
          sourceCode
            .getDeclaredVariables(node)
            .every((variable) => !variable.references.some((reference) => reference.isRead()))
        ) {
          context.report({ node: unread, messageId: "settled" });
        }
      },
    };
  },
});
