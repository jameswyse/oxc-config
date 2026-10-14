// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noRuntimeTypeof } from "./no-runtime-typeof.ts";

const error = { messageId: "runtimeTypeof" };
const allowInTypeGuards = [{ allowInTypeGuards: true }];
ruleTester.run("no-runtime-typeof", noRuntimeTypeof, {
  valid: [
    'const isServer = typeof document === "undefined";',
    'const hasStorage = typeof localStorage !== "undefined";',
    'if (typeof globalThis.crypto === "undefined") throw new Error("no crypto");',
    'const missing = "undefined" === typeof process;',
    "const value = input;",
    'export function label(value: string | Block[]) { return typeof value === "string" ? value : render(value); }',
    'type Fixture = Promise<Input> | (() => Input); export function load(fixture: Fixture) { return typeof fixture === "function" ? fixture() : fixture; }',
    'export function size(value: (string | number)) { return typeof value === "number" ? value : value.length; }',
    {
      code: 'function isString(value: unknown): value is string { return typeof value === "string"; }',
      options: allowInTypeGuards,
    },
    {
      code: 'const isString = (value: unknown): value is string => typeof value === "string";',
      options: allowInTypeGuards,
    },
    {
      code: 'function assertString(value: unknown): asserts value is string { if (typeof value !== "string") throw new Error(); }',
      options: allowInTypeGuards,
    },
  ],
  invalid: [
    {
      code: 'export function label(value: unknown) { return typeof value === "string" ? value : ""; }',
      errors: [error],
    },
    {
      code: 'export function label(value: string | unknown) { return typeof value === "string" ? value : ""; }',
      errors: [error],
    },
    {
      code: 'type Maybe<T> = string | T; export function label(value: Maybe<unknown>) { return typeof value === "string" ? value : ""; }',
      errors: [error],
    },
    {
      code: 'export function label(input: { value: string | number }) { return typeof input.value === "string"; }',
      errors: [error],
    },
    { code: 'if (typeof input === "string") use(input);', errors: [error] },
    { code: "if (typeof input === undefined) use(input);", errors: [error] },
    {
      code: 'function isString(value: unknown): value is string { return typeof value === "string"; }',
      errors: [error],
    },
    {
      code: 'function parse(value: unknown): string { if (typeof value !== "string") throw new Error(); return value; }',
      options: allowInTypeGuards,
      errors: [error],
    },
    {
      code: 'function isString(value: unknown): value is string { const check = () => typeof value === "string"; return check(); }',
      options: allowInTypeGuards,
      errors: [error],
    },
  ],
});
