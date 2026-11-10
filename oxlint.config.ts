import { createLintConfig } from "./src/oxlint/config.ts";

export default createLintConfig({
  node: true,
  rules: { "wyse/no-comments": ["error", { allow: ["^Adapted from "] }] },
  overrides: [
    {
      files: ["src/**/*.ts"],
      rules: { "import/no-default-export": "off", "wyse/no-runtime-typeof": "off" },
    },
    { files: ["src/oxlint/profiles.ts"], rules: { "wyse/no-forwarding-module": "off" } },
  ],
});
