import { defineRule } from "@oxlint/plugins";

import {
  dynamicParts,
  isGlobalValue,
  staticPropertyName,
  unwrapExpression,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const escapeHelper = /^escape(?:String)?Reg(?:ex|Exp?)$/iu;

function isEscapeFunction(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const callee = unwrapExpression(node);

  if (callee.type === "Identifier") {
    return escapeHelper.test(callee.name);
  }

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const name = staticPropertyName(callee);

  return (
    (name === "escape" && isGlobalValue(sourceCode, callee.object, "RegExp")) ||
    (name !== null && escapeHelper.test(name))
  );
}

function isEscapeCall(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const call = unwrapExpression(node);

  return call.type === "CallExpression" && isEscapeFunction(sourceCode, call.callee);
}

function isEscapeMapper(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const mapper = unwrapExpression(node);

  if (mapper.type !== "ArrowFunctionExpression") {
    return isEscapeFunction(sourceCode, mapper);
  }

  const body = mapper.body.type === "BlockStatement" ? null : mapper.body;

  return body !== null && isEscapeCall(sourceCode, body);
}

function isEscapedJoin(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const [separator] = node.type === "CallExpression" ? node.arguments : [];
  const join = node.type === "CallExpression" ? unwrapExpression(node.callee) : null;
  const map = join?.type === "MemberExpression" ? unwrapExpression(join.object) : null;
  const mapCallee = map?.type === "CallExpression" ? unwrapExpression(map.callee) : null;
  const [mapper] = map?.type === "CallExpression" ? map.arguments : [];

  return (
    join?.type === "MemberExpression" &&
    staticPropertyName(join) === "join" &&
    mapCallee?.type === "MemberExpression" &&
    staticPropertyName(mapCallee) === "map" &&
    mapper !== undefined &&
    isEscapeMapper(sourceCode, mapper) &&
    (separator === undefined ||
      (separator.type !== "SpreadElement" && dynamicParts(sourceCode, separator).length === 0))
  );
}

function isEscapedValue(sourceCode: SourceCode, node: ESTree.Node): boolean {
  return isEscapeCall(sourceCode, node) || isEscapedJoin(sourceCode, node);
}

export const noDynamicRegex = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow regular expressions built from values known only at run time." },
    schema: [],
    messages: {
      dynamic:
        "This builds a regular expression from a value known only at run time, so the value can change what it matches or make matching backtrack for a long time. Write the pattern as a literal, or escape the value with `RegExp.escape`.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function check(node: ESTree.CallExpression | ESTree.NewExpression): void {
      const [pattern] = node.arguments;

      if (
        pattern !== undefined &&
        isGlobalValue(sourceCode, node.callee, "RegExp") &&
        (pattern.type === "SpreadElement" ||
          !dynamicParts(sourceCode, pattern).every((part) => isEscapedValue(sourceCode, part)))
      ) {
        context.report({ node: pattern, messageId: "dynamic" });
      }
    }

    return { CallExpression: check, NewExpression: check };
  },
});
