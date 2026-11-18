import { errorRules } from "../preset.ts";

import type { BaseProfile, LintLayer, LintScope } from "../preset.ts";

function typeAwareLayers(scope: LintScope) {
  return [
    {
      files: scope.typeScript,
      rules: {
        ...errorRules("typescript", [
          "no-unnecessary-condition",
          "no-unnecessary-type-assertion",
          "no-unsafe-argument",
          "no-unsafe-assignment",
          "no-unsafe-call",
          "no-unsafe-member-access",
          "no-unsafe-return",
          "no-unsafe-type-assertion",
          "prefer-reduce-type-parameter",
          "switch-exhaustiveness-check",
        ]),
        "typescript/restrict-plus-operands": [
          "error",
          {
            allowAny: false,
            allowBoolean: false,
            allowNullish: false,
            allowNumberAndString: false,
            allowRegExp: false,
          },
        ],
      },
    },
    {
      files: scope.typeScript,
      excludeFiles: scope.tests,
      rules: { "typescript/no-deprecated": "warn" },
    },
  ] satisfies LintLayer[];
}

export const types: BaseProfile = (scope) => [
  {
    rules: {
      ...errorRules("typescript", [
        "consistent-type-imports",
        "no-explicit-any",
        "no-non-null-assertion",
        "no-empty-object-type",
        "no-unnecessary-type-constraint",
        "no-import-type-side-effects",
        "no-unsafe-function-type",
      ]),
      "typescript/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": { descriptionFormat: "^\\s*-{2,}\\s+\\S" },
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
        },
      ],
      "typescript/consistent-type-assertions": [
        "error",
        {
          assertionStyle: "as",
          objectLiteralTypeAssertions: "never",
          arrayLiteralTypeAssertions: "never",
        },
      ],
      "typescript/method-signature-style": ["error", "property"],
      ...errorRules("wyse", [
        "type-guard-name",
        "no-generic-object-guard",
        "no-chained-type-assertions",
        "no-known-value-widening",
        "no-object-parameters",
        "no-reflect-apply",
        "no-reflect-get",
        "no-unknown-returns",
        "no-unknown-type-aliases",
        "no-unsafe-dictionary-type",
        "no-widen-then-assert",
      ]),
      "wyse/no-runtime-typeof": ["warn", { allowInTypeGuards: true }],
    },
  },
  { files: scope.typeScript, rules: { "wyse/no-internal-return-types": "error" } },
  ...(scope.typeAware ? typeAwareLayers(scope) : []),
];
