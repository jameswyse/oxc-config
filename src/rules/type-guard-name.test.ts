import { ruleTester } from "../shared/rule-tester.ts";
import { typeGuardName } from "./type-guard-name.ts";

ruleTester.run("type-guard-name", typeGuardName, {
  valid: [
    'function isString(value: unknown): value is string { return typeof value === "string"; }',
    'const hasName = (value: unknown): value is { name: string } => typeof value === "object";',
    'function assertString(value: unknown): asserts value is string { if (typeof value !== "string") throw Error(); }',
    'values.filter((value): value is string => typeof value === "string");',
    'const guards = { [key](value: unknown): value is string { return typeof value === "string"; } };',
    'class Guards { static [key](value: unknown): value is string { return typeof value === "string"; } }',
    "type StringGuard = (value: unknown) => value is string;",
    "interface Guard { (value: unknown): value is string; }",
    "interface Guards { isString(value: unknown): value is string; hasName: (value: unknown) => value is string; }",
    'const check = (value: unknown): boolean => typeof value === "string";',
    'const isString: (value: unknown) => value is string = value => typeof value === "string";',
    'const assertString: (value: unknown) => asserts value is string = value => { if (typeof value !== "string") throw Error(); };',
  ],
  invalid: [
    {
      code: 'function check(value: unknown): value is string { return typeof value === "string"; }',
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: 'const check = (value: unknown): value is string => typeof value === "string";',
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: 'const check = function(value: unknown): value is string { return typeof value === "string"; };',
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: 'const guards = { check(value: unknown): value is string { return typeof value === "string"; } };',
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: 'class Guards { static check(value: unknown): value is string { return typeof value === "string"; } }',
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: "interface Guards { check(value: unknown): value is string; }",
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: "interface Guards { check: (value: unknown) => value is string; }",
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: "declare function check(value: unknown): value is string;",
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: 'const island = (value: unknown): value is string => typeof value === "string";',
      errors: [{ messageId: "name", data: { name: "island" } }],
    },
    {
      code: 'const check: (value: unknown) => value is string = value => typeof value === "string";',
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
    {
      code: 'const check: (value: unknown) => value is string = (value): value is string => typeof value === "string";',
      errors: [{ messageId: "name", data: { name: "check" } }],
    },
  ],
});
