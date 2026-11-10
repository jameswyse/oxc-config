import { errorRules } from "../preset.ts";

import type { BaseProfile } from "../preset.ts";

export const security: BaseProfile = () => [
  {
    rules: errorRules("wyse", [
      "no-disabled-tls-verification",
      "no-hardcoded-credential",
      "no-secret-fallback",
    ]),
  },
];
