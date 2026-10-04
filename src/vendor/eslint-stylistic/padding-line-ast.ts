// Adapted from ESLint Stylistic's padding-line-between-statements rule, by way of anti-slop.
import type { Comment, ESTree, SourceCode, Span, Token } from "@oxlint/plugins";

type TokenOrComment = Token | Comment;

const LINEBREAKS = new Set(["\r\n", "\r", "\n", "\u2028", "\u2029"]);

const isClosingBraceToken = (token: TokenOrComment): boolean =>
  token.type === "Punctuator" && token.value === "}";

const isSemicolonToken = (token: TokenOrComment): boolean =>
  token.type === "Punctuator" && token.value === ";";

const isNotSemicolonToken = (token: TokenOrComment): boolean => !isSemicolonToken(token);

const isTokenOnSameLine = (left: Pick<Span, "loc">, right: Pick<Span, "loc">): boolean =>
  left.loc.end.line === right.loc.start.line;

const isFunction = (node: ESTree.Node): boolean =>
  node.type === "FunctionDeclaration" ||
  node.type === "FunctionExpression" ||
  node.type === "ArrowFunctionExpression";

const isSingleLine = (node: ESTree.Node): boolean => node.loc.start.line === node.loc.end.line;

const skipChainExpression = (node: ESTree.Node): ESTree.Node =>
  node.type === "ChainExpression" ? node.expression : node;

const isTopLevelExpressionStatement = (node: ESTree.Node): node is ESTree.ExpressionStatement =>
  node.type === "ExpressionStatement" &&
  (node.parent.type === "Program" ||
    (node.parent.type === "BlockStatement" && isFunction(node.parent.parent)));

function isParenthesized(node: ESTree.Node, sourceCode: SourceCode): boolean {
  const before = sourceCode.getTokenBefore(node);
  const after = sourceCode.getTokenAfter(node);

  return before?.value === "(" && after?.value === ")";
}

export type { TokenOrComment };

export {
  LINEBREAKS,
  isClosingBraceToken,
  isFunction,
  isNotSemicolonToken,
  isParenthesized,
  isSemicolonToken,
  isSingleLine,
  isTokenOnSameLine,
  isTopLevelExpressionStatement,
  skipChainExpression,
};
