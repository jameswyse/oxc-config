import { errorRules } from "../preset.ts";

import type { BaseProfile } from "../preset.ts";

export const core: BaseProfile = (scope) => [
  {
    rules: {
      ...errorRules("eslint", [
        "no-array-constructor",
        "no-implicit-coercion",
        "no-new-func",
        "no-new-wrappers",
        "no-proto",
        "no-prototype-builtins",
        "no-var",
        "prefer-object-has-own",
        "prefer-rest-params",
      ]),
      "eslint/prefer-regex-literals": ["error", { disallowRedundantWrapping: true }],
      ...errorRules("unicorn", [
        "new-for-builtins",
        "no-instanceof-array",
        "no-new-buffer",
        "prefer-array-find",
        "prefer-array-flat-map",
        "prefer-array-some",
        "prefer-import-meta-properties",
        "prefer-node-protocol",
        "prefer-response-static-json",
        "prefer-string-trim-start-end",
      ]),
      "import/no-mutable-exports": "error",
      "oxc/no-const-enum": "error",
      "eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "eslint/no-use-before-define": [
        "error",
        { functions: true, classes: true, variables: true, allowNamedExports: false },
      ],
      "eslint/no-underscore-dangle": "off",
      "unicorn/consistent-function-scoping": "off",
    },
  },
  { files: scope.entrypoints, plugins: ["node"], env: { node: true }, rules: {} },
];
