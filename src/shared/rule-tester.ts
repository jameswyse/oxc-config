import { describe, it } from "node:test";

import { RuleTester } from "oxlint/plugins-dev";

RuleTester.describe = (text, fn) => {
  void describe(text, fn);
};

RuleTester.it = (text, fn) => {
  void it(text, fn);
};

export const ruleTester = new RuleTester({ languageOptions: { parserOptions: { lang: "ts" } } });
