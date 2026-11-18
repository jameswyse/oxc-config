import { errorRules } from "../preset.ts";

import type { BaseProfile, LintLayer, LintScope } from "../preset.ts";

function typeAwareLayers(scope: LintScope) {
  return [
    {
      files: scope.typeScript,
      rules: {
        ...errorRules("typescript", [
          "await-thenable",
          "no-misused-promises",
          "only-throw-error",
          "prefer-promise-reject-errors",
          "return-await",
          "use-unknown-in-catch-callback-variable",
        ]),
        "typescript/no-floating-promises": [
          "error",
          {
            allowForKnownSafeCalls: [
              { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
            ],
          },
        ],
      },
    },
  ] satisfies LintLayer[];
}

export const errors: BaseProfile = (scope) => [
  {
    rules: {
      ...errorRules("eslint", [
        "array-callback-return",
        "no-case-declarations",
        "no-constructor-return",
        "no-fallthrough",
        "no-loop-func",
        "no-self-compare",
        "no-unreachable-loop",
        "no-useless-assignment",
      ]),
      "eslint/curly": ["error", "all"],
      "eslint/eqeqeq": ["error", "always"],
      "eslint/no-empty": ["error", { allowEmptyCatch: false }],
      "unicorn/error-message": "error",
      "unicorn/no-nested-ternary": "off",
      "wyse/no-deep-ternary": "error",
      "wyse/no-unchecked-index-search": "error",
      "wyse/no-swallowed-errors": "warn",
      "wyse/explicit-api-states": "warn",
    },
  },
  {
    files: scope.javaScript,
    rules: errorRules("eslint", ["no-throw-literal", "prefer-promise-reject-errors"]),
  },
  {
    files: scope.source,
    excludeFiles: scope.tests,
    rules: errorRules("wyse", ["no-unchecked-fetch-response", "no-unsettled-promise"]),
  },
  ...(scope.typeAware ? typeAwareLayers(scope) : []),
];
