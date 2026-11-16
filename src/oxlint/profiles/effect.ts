import { errorRules, filesFor } from "../preset.ts";

import type { FileScope, Profile } from "../preset.ts";

export const effect: Profile<FileScope> = (scope, files) => [
  {
    files: filesFor(files, scope.typeScript),
    rules: errorRules("wyse", ["no-manual-effect-error-tag", "no-service-constructor-imports"]),
  },
  {
    files: filesFor(files, scope.typeScript),
    excludeFiles: scope.tests,
    rules: {
      "wyse/no-dropped-error-cause": "warn",
      "wyse/no-unbounded-retry": "warn",
      "wyse/require-service-operation-span": "warn",
    },
  },
];
