import { ruleTester } from "../shared/rule-tester.ts";
import { noVacuousTestAssertions } from "./no-vacuous-test-assertions.ts";

ruleTester.run("no-vacuous-test-assertions", noVacuousTestAssertions, {
  valid: [
    "expect(calculateTotal([10, 5])).toBe(15);",
    "expect(15).toBe(calculateTotal([10, 5]));",
    "expect(read()).toEqual(read());",
    "expect(value.current).toBe(value.current);",
    "expect(/value/).toEqual(/value/);",
    "expect({ value: 1 }).toEqual({ value: 1 });",
    "expect(value).resolves.toBe(value);",
    "expect(value).rejects.toEqual(value);",
    "expect.assertions(1); expect.hasAssertions();",
    "expect.assertions(1).toBe(1);",
    "function check(expect) { expect(1).toBe(1); }",
    'import { expect } from "./domain"; expect(1).toBe(1);',
    'import { expect as verify } from "vitest"; function check(verify) { verify(1).toBe(1); }',
    'import * as suite from "vitest"; function check(suite) { suite.expect(1).toBe(1); }',
    "expect.call(null, 1).toBe(1);",
    "expect(1).unknown.toBe(1);",
    "expect(1).toBeGreaterThan(0);",
    "expect(value).toBe(otherValue);",
    'import { expect } from "@playwright/test"; function suite(expect) { expect(1).toBe(1); }',
    'import { expect } from "@playwright/test"; expect(value).resolves.toBe(value);',
    'import { expect } from "@effect/vitest"; function suite(expect) { expect(1).toBe(1); }',
    'import expect from "@playwright/test"; expect(1).toBe(1);',
  ],
  invalid: [
    { code: "expect(true).toBe(true);", errors: [{ messageId: "vacuous" }] },
    { code: "expect(1).toEqual(2);", errors: [{ messageId: "vacuous" }] },
    { code: "expect(-1).not.toStrictEqual(2);", errors: [{ messageId: "vacuous" }] },
    { code: "expect(null).toBe(null);", errors: [{ messageId: "vacuous" }] },
    { code: "expect(1n).toBe(1n);", errors: [{ messageId: "vacuous" }] },
    {
      code: "const value = compute(); expect(value).toBe(value);",
      errors: [{ messageId: "vacuous" }],
    },
    {
      code: 'import { expect as verify } from "vitest"; verify("ready").toEqual("ready");',
      errors: [{ messageId: "vacuous" }],
    },
    {
      code: 'import * as suite from "@jest/globals"; suite.expect(1).toStrictEqual(1);',
      errors: [{ messageId: "vacuous" }],
    },
    {
      code: 'import { expect } from "vitest"; const verify = expect; verify(1).toBe(1);',
      errors: [{ messageId: "vacuous" }],
    },
    {
      code: 'import { expect } from "@playwright/test"; expect(1).toBe(1);',
      errors: [{ messageId: "vacuous" }],
    },
    {
      code: 'import { expect as verify } from "playwright/test"; verify("ready").toStrictEqual("ready");',
      errors: [{ messageId: "vacuous" }],
    },
    {
      code: 'import { expect } from "@effect/vitest"; expect(1).toEqual(1);',
      errors: [{ messageId: "vacuous" }],
    },
  ],
});
