import { errorRules } from "../preset.ts";

import type { BaseProfile } from "../preset.ts";

export const mutation: BaseProfile = (scope) => [
  {
    rules: {
      ...errorRules("eslint", ["no-param-reassign", "prefer-const"]),
      "oxc/no-accumulating-spread": "error",
      ...errorRules("wyse", [
        "no-array-filter-map",
        "no-conditional-empty-object-spread",
        "no-reduce-accumulator-copy",
      ]),
    },
  },
  ...(scope.typeAware
    ? [{ files: scope.typeScript, rules: errorRules("typescript", ["prefer-readonly"]) }]
    : []),
];
