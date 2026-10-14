import { ruleTester } from "../shared/rule-tester.ts";
import { noGenericObjectGuard } from "./no-generic-object-guard.ts";

const error = { messageId: "guard" };

ruleTester.run("no-generic-object-guard", noGenericObjectGuard, {
  valid: [
    "function isPresent<T>(value: T | null): value is T { return value !== null; }",
    "function isDefined(value: unknown): value is NonNullable<unknown> { return value !== null && value !== undefined; }",
    "import { Object } from './model'; function isPlain(value: unknown): boolean { return Object.prototype.toString.call(value) === '[object Object]'; }",
    "function isCircle(shape: Shape): shape is Circle { return shape.kind === 'circle'; }",
    "function isUser(value: unknown): value is User { return userSchema.safeParse(value).success; }",
    "function isUser(value: unknown): value is User { return typeof value === 'object' && value !== null && 'id' in value; }",
    "const isText = (value: unknown): value is string => typeof value === 'string';",
    "const objects = values.filter((value) => typeof value === 'object' && value !== null);",
    "function isPresent(value: unknown) { return value !== null && value !== undefined; }",
    "function isList(value: unknown): value is unknown[] { return Array.isArray(value); }",
    "function walk(value: unknown) { if (typeof value === 'object' && value !== null) { visit(value); } }",
    "function isOwned(value: unknown, owner: Owner) { return typeof value === 'object' && value !== null; }",
    "function isMissing(value: unknown) { return typeof value === 'object' && value === null; }",
    'function isUser(value: unknown): value is User { if (typeof value !== "object" || value === null) return false; return "id" in value; }',
  ],
  invalid: [
    {
      code: 'function isRecord(value: unknown): value is Record<string, unknown> { if (value === null) { return false; } return typeof value === "object"; }',
      errors: [error],
    },
    {
      code: 'function isRecord(value: unknown): value is Record<string, unknown> { if (typeof value !== "object" || !value || Array.isArray(value)) return false; return true; }',
      errors: [error],
    },
    {
      code: 'const isRecord = (value: unknown): value is object => (typeof value === "object" && value !== null) satisfies boolean;',
      errors: [error],
    },
    {
      code: "function isUser(value: unknown): value is User { return value !== null; }",
      errors: [{ messageId: "unproven" }],
    },
    {
      code: "const users = values.filter((value: unknown): value is User => Boolean(value));",
      errors: [{ messageId: "unproven" }],
    },
    {
      code: "export const isConfig = (value: any): value is Config => true;",
      errors: [{ messageId: "unproven" }],
    },
    {
      code: "function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }",
      errors: [error],
    },
    {
      code: "export const isCmsObject = (input: unknown): input is object => input !== null && typeof input === 'object' && !Array.isArray(input);",
      errors: [error],
    },
    {
      code: "const isJsonObject = function (value: unknown) { return !!value && typeof value === 'object'; };",
      errors: [error],
    },
    {
      code: "function isPlainObject(value: unknown): boolean { return Object.prototype.toString.call(value) === '[object Object]'; }",
      errors: [error],
    },
    {
      code: "function isPlainObject(value: unknown) { return value instanceof Object && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }",
      errors: [error],
    },
    {
      code: "function isPlainObject(value: unknown) { return value instanceof Object && (Object.prototype === Object.getPrototypeOf(value) || null === Object.getPrototypeOf(value)); }",
      errors: [error],
    },
    {
      code: "function isPlainObject(value: unknown): boolean { return '[object Object]' === Object.prototype.toString.call(value); }",
      errors: [error],
    },
    {
      code: "function isUser(value: unknown): value is NonNullable<User> { return value !== null && value !== undefined; }",
      errors: [{ messageId: "unproven" }],
    },
    {
      code: "const guards = { isObjectLike(value: unknown) { return value != null && (typeof value === 'object' || typeof value === 'function'); } };",
      errors: [error],
    },
    {
      code: "class Parser { static isRecord(value: unknown): value is object { return Boolean(value) && typeof value == 'object'; } }",
      errors: [error],
    },
  ],
});
