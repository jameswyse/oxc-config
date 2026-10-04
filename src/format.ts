import { defaultIgnores } from "./lint.ts";

import type { OxfmtConfig, SortImportsConfig } from "oxfmt";

export const formatConfig: OxfmtConfig & {
  ignorePatterns: string[];
  sortImports: SortImportsConfig;
} = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  jsxSingleQuote: false,
  trailingComma: "all",
  bracketSpacing: true,
  arrowParens: "always",
  endOfLine: "lf",
  ignorePatterns: defaultIgnores,
  sortImports: {
    internalPattern: ["@/", "~/", "#"],
    sortSideEffects: false,
    groups: [
      "value-builtin",
      "next-libs",
      "react-libs",
      "value-external",
      "value-internal",
      ["value-parent", "value-sibling", "value-index"],
      "type-builtin",
      "type-external",
      "type-internal",
      ["type-parent", "type-sibling", "type-index"],
      "unknown",
      "style",
    ],
    customGroups: [
      {
        groupName: "next-libs",
        elementNamePattern: ["next", "next/*"],
        modifiers: ["value"],
        selector: "external",
      },
      {
        groupName: "react-libs",
        elementNamePattern: ["react", "react-dom", "react-dom/*"],
        modifiers: ["value"],
        selector: "external",
      },
    ],
  },
  sortPackageJson: { sortScripts: true },
};
