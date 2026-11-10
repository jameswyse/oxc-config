import { errorRules } from "../preset.ts";

import type { BaseProfile } from "../preset.ts";

const defaultExportFiles = [
  "**/*.d.{ts,mts,cts}",
  "**/*.stories.{js,jsx,mjs,ts,tsx,mts}",
  "**/.storybook/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
];

export const modules: BaseProfile = (scope) => [
  {
    rules: {
      ...errorRules("import", ["first", "no-default-export", "no-duplicates", "no-self-import"]),
      "import/no-unassigned-import": [
        "error",
        { allow: ["**/*.css", "server-only", "client-only"] },
      ],
      "import/no-cycle": "warn",
      "oxc/no-barrel-file": "warn",
      "unicorn/require-module-specifiers": "error",
      "wyse/no-generic-file-suffix": "error",
      "wyse/no-shape-in-symbol-names": "error",
      "wyse/no-forwarding-module": "warn",
      "wyse/no-pass-through-function": "warn",
    },
  },
  {
    files: scope.entrypoints,
    rules: { "import/no-default-export": "off", "wyse/no-forwarding-module": "off" },
  },
  { files: defaultExportFiles, rules: { "import/no-default-export": "off" } },
  {
    files: scope.source,
    excludeFiles: [...scope.tests, ...scope.entrypoints, ...scope.programs],
    rules: { "wyse/no-import-time-effects": "warn" },
  },
];
