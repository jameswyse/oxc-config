// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noChainedTypeAssertions } from "./no-chained-type-assertions.ts";

const error = { messageId: "chained" };
ruleTester.run("no-chained-type-assertions", noChainedTypeAssertions, {
  valid: [
    "const value = input as User;",
    "const value = (input as User);",
    "const value = ({ id: 1 } as const) as const;",
  ],
  invalid: [
    { name: "as chain", code: "const value = input as unknown as User;", errors: [error] },
    {
      name: "parenthesized chain",
      code: "const value = (input as unknown) as User;",
      errors: [error],
    },
    { name: "angle-bracket chain", code: "const value = <User>(<unknown>input);", errors: [error] },
    {
      name: "mixed const chain",
      code: "const value = ({ id: 1 } as const) as User;",
      errors: [error],
    },
  ],
});
