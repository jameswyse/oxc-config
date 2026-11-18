import { describe, it } from "node:test";

import { RuleTester } from "oxlint/plugins-dev";

RuleTester.describe = (text, fn) => {
  void describe(text, fn);
};

RuleTester.it = (text, fn) => {
  void it(text, fn);
};

export const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });

export function lintNow(
  ruleName: string,
  rule: Parameters<RuleTester["run"]>[1],
  tests: RuleTester.TestCases,
): void {
  const { describe: registerDescribe, it: registerIt } = RuleTester;

  RuleTester.describe = (_text, run) => {
    run();
  };

  RuleTester.it = (_text, run) => {
    run();
  };

  try {
    ruleTester.run(ruleName, rule, tests);
  } finally {
    RuleTester.describe = registerDescribe;
    RuleTester.it = registerIt;
  }
}
