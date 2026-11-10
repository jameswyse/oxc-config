import { errorRules, filesFor } from "../preset.ts";

import type { BaseProfile, FileScope, Profile } from "../preset.ts";

const runnerRules = [
  "no-conditional-expect",
  "no-disabled-tests",
  "no-duplicate-hooks",
  "no-focused-tests",
  "no-identical-title",
  "no-interpolation-in-snapshots",
  "no-standalone-expect",
  "no-unneeded-async-expect-function",
  "prefer-comparison-matcher",
  "prefer-equality-matcher",
  "prefer-strict-equal",
  "prefer-to-contain",
  "prefer-to-have-length",
  "valid-describe-callback",
  "valid-expect",
  "valid-expect-in-promise",
];

export const tests: BaseProfile = (scope) => [
  { rules: { "wyse/no-module-mocking": "error" } },
  {
    files: scope.tests,
    rules: {
      ...errorRules("wyse", [
        "no-fixed-test-delay",
        "no-vacuous-test-assertions",
        "no-edit-proof-assertions",
        "no-optional-test-action",
      ]),
      "wyse/no-derived-test-expectation": "warn",
      "wyse/companion-has-owner": "warn",
    },
  },
  {
    files: scope.tests,
    excludeFiles: scope.endToEnd,
    rules: {
      "wyse/no-test-timeout-overrides": "warn",
      "wyse/no-uncontrolled-test-clock": "error",
    },
  },
];

function testRunner(name: "vitest" | "jest", extraRules: string[]): Profile<FileScope> {
  const runner: Profile<FileScope> = (scope, files) => [
    {
      files: filesFor(files, scope.tests),
      plugins: [name],
      env: { [name]: true },
      rules: {
        ...errorRules(name, [...runnerRules, ...extraRules]),
        [`${name}/no-standalone-expect`]: [
          "error",
          { additionalTestBlockFunctions: ["it.effect", "it.live"] },
        ],
      },
    },
  ];

  runner.testFiles = (files) => filesFor(files, []);

  return runner;
}

export const vitest: Profile<FileScope> = testRunner("vitest", []);

export const jest: Profile<FileScope> = testRunner("jest", ["no-done-callback"]);
