import { errorRules } from "../preset.ts";

import type { BaseProfile } from "../preset.ts";

export const security: BaseProfile = (scope) => [
  {
    rules: {
      "import/no-dynamic-require": "error",
      ...errorRules("wyse", [
        "no-bidi-control-characters",
        "no-disabled-tls-verification",
        "no-dynamic-regex",
        "no-exponential-regex",
        "no-hardcoded-credential",
        "no-secret-fallback",
      ]),
    },
  },
  {
    files: scope.source,
    excludeFiles: [...scope.tests, ...scope.endToEnd],
    rules: errorRules("wyse", ["no-dynamic-shell-command", "no-timing-unsafe-comparison"]),
  },
];
