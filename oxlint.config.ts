import { createLintConfig } from "./src/lint.ts";

const config = createLintConfig({ node: true });

export default {
  ...config,
  rules: { ...config.rules, "wyse/no-comments": ["error", { allow: ["^Adapted from "] }] },
  overrides: [
    ...config.overrides,
    {
      files: ["src/**/*.ts"],
      rules: { "import/no-default-export": "off", "wyse/no-runtime-typeof": "off" },
    },
  ],
};
