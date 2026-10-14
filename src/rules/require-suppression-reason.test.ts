import { ruleTester } from "../shared/rule-tester.ts";
import { requireSuppressionReason } from "./require-suppression-reason.ts";

ruleTester.run("require-suppression-reason", requireSuppressionReason, {
  valid: [
    "// oxlint-disable-next-line no-console -- the CLI reports startup failures on stderr\nconsole.error(error);",
    "/* eslint-disable no-console -- this script prints its report */\nconsole.log(report);",
    "console.log(report); // oxlint-disable-line no-console -- the report is the output",
    "/*\n * oxlint-disable typescript/no-unsafe-type-assertion, wyse/no-chained-type-assertions\n * -- the generated client returns untyped JSON\n */\nexport const value = 1;",
    "// oxlint-disable-next-line no-console --- prints the summary\nconsole.log(summary);",
    "/* oxlint-enable no-console */\nexport const value = 1;",
    "// @ts-expect-error the fixture omits a required field\nconst value: User = {};",
    "// see oxlint-disable docs\nexport const value = 1;",
  ],
  invalid: [
    {
      code: "// oxlint-disable-next-line no-console\nconsole.error(error);",
      errors: [{ messageId: "reason" }],
    },
    {
      code: "/* eslint-disable no-console */\nconsole.log(report);",
      errors: [{ messageId: "reason" }],
    },
    {
      code: "console.log(report); // oxlint-disable-line no-console --",
      errors: [{ messageId: "reason" }],
    },
    {
      code: "// oxlint-disable-next-line no-console --because\nconsole.error(error);",
      errors: [{ messageId: "reason" }],
    },
    {
      code: "// oxlint-disable-next-line -- the output is the report\nconsole.log(report);",
      errors: [{ messageId: "rule" }],
    },
    {
      code: "/* eslint-disable */\nconsole.log(report);",
      errors: [{ messageId: "rule" }],
    },
  ],
});
