import { defineRule } from "@oxlint/plugins";

import createPaddingLineRule from "../vendor/eslint-stylistic/padding-line-between-statements.ts";

import type { SelectorOption } from "../vendor/eslint-stylistic/padding-line-between-statements.ts";

const multilineDeclaration = {
  selector:
    ':matches(VariableDeclaration, ExportNamedDeclaration[declaration.type="VariableDeclaration"])',
  lineMode: "multiline",
} satisfies SelectorOption;

const typeAlias = {
  selector:
    ':matches(TSTypeAliasDeclaration, ExportNamedDeclaration[declaration.type="TSTypeAliasDeclaration"])',
} satisfies SelectorOption;

const paddingRule = createPaddingLineRule([
  { blankLine: "always", prev: "multiline-block-like", next: "*" },
  { blankLine: "always", prev: "*", next: "multiline-block-like" },
  { blankLine: "always", prev: "*", next: "return" },
  { blankLine: "always", prev: "import", next: "*" },
  { blankLine: "any", prev: "import", next: "import" },
  { blankLine: "always", prev: "*", next: multilineDeclaration },
  { blankLine: "always", prev: multilineDeclaration, next: "*" },
  { blankLine: "any", prev: multilineDeclaration, next: typeAlias },
]);

export const statementSpacing = defineRule({
  ...paddingRule,
  meta: {
    ...paddingRule.meta,
    docs: {
      description:
        "Separate imports, multiline blocks, multiline declarations and returns from neighbouring statements.",
    },
    schema: [],
  },
});
