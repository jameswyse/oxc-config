import type { BaseProfile } from "../preset.ts";

export const comments: BaseProfile = (scope) => [
  {
    rules: {
      "wyse/no-comments": "error",
      "wyse/require-suppression-reason": "error",
      "eslint/no-console": "error",
    },
  },
  { files: scope.entrypoints, rules: { "eslint/no-console": "off" } },
];
