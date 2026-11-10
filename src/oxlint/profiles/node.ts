import { errorRules, filesFor } from "../preset.ts";

import type { FileScope, Profile } from "../preset.ts";

export const node: Profile<FileScope> = (scope, files) => [
  {
    files: filesFor(files, scope.source),
    plugins: ["node"],
    env: { node: true },
    rules: errorRules("node", ["no-new-require", "no-path-concat", "no-exports-assign"]),
  },
];
