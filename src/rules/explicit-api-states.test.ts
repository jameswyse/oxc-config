import { ruleTester } from "../shared/rule-tester.ts";
import { explicitApiStates } from "./explicit-api-states.ts";

ruleTester.run("explicit-api-states", explicitApiStates, {
  valid: [
    "function local(flag: boolean) { return flag; }",
    "export function load({ force }: { force: boolean }) { return force; }",
    "export function Title({ leftAligned }: Readonly<{ leftAligned: boolean }>) { return leftAligned; }",
    "export function merge(base: User, overrides: Partial<User>) { return { ...base, ...overrides }; }",
    "export function setEnabled(enabled: boolean) { state.enabled = enabled; }",
    "export function updateCalendarHidden(id: string, hidden: boolean) { return save(id, hidden); }",
    "export type Toggle = (enabled: boolean) => void;",
    "export declare function load(force: boolean): void;",
    "export function count(limit: number, label?: string) { return limit; }",
    "export class Store { set enabled(value: boolean) {} private reset(force: boolean) {} protected load(force: boolean) {} #drop(force: boolean) {} }",
    "export function choose(mode: boolean | string) { return mode; }",
    "callbacks.on('change', (open: boolean) => open);",
  ],
  invalid: [
    {
      code: "export function getEvents(start: string, includeCancelled: boolean) { return includeCancelled; }",
      errors: [
        { messageId: "boolean", data: { parameter: "includeCancelled", name: "getEvents" } },
      ],
    },
    {
      code: "export function build(checkOnly = false) { return checkOnly; }",
      errors: [{ messageId: "boolean", data: { parameter: "checkOnly", name: "build" } }],
    },
    {
      code: "export const humanName = (maximum: number, required?: boolean) => required;",
      errors: [{ messageId: "boolean", data: { parameter: "required", name: "humanName" } }],
    },
    {
      code: "export const classify = function (cover: string, extended: boolean | undefined) { return extended; };",
      errors: [{ messageId: "boolean", data: { parameter: "extended", name: "classify" } }],
    },
    {
      code: "export default function (force: boolean) { return force; }",
      errors: [{ messageId: "boolean", data: { parameter: "force", name: "default" } }],
    },
    {
      code: "function sync(fullSync: boolean) { return fullSync; } export { sync };",
      errors: [{ messageId: "boolean", data: { parameter: "fullSync", name: "sync" } }],
    },
    {
      code: "class Service { sync(id: string, fullSync = false) {} } export default Service;",
      errors: [{ messageId: "boolean", data: { parameter: "fullSync", name: "Service.sync" } }],
    },
    {
      code: "export class ApiError extends Error { constructor(message: string, public readonly retryable: boolean) { super(message); } }",
      errors: [
        { messageId: "boolean", data: { parameter: "retryable", name: "ApiError.constructor" } },
      ],
    },
    {
      code: "export class Cache { static { warm(); } [key: string]: unknown; flush(id: string, force: boolean) {} }",
      errors: [{ messageId: "boolean", data: { parameter: "force", name: "Cache.flush" } }],
    },
    {
      code: "export class Window { open = (url: string, focus: boolean) => focus; }",
      errors: [{ messageId: "boolean", data: { parameter: "focus", name: "Window.open" } }],
    },
    {
      code: "export function setTheme(isDark: boolean, color: string) { return color; }",
      errors: [{ messageId: "boolean", data: { parameter: "isDark", name: "setTheme" } }],
    },
    {
      code: "export function load(force: boolean): void; export function load(force?: boolean) {}",
      errors: [{ messageId: "boolean", data: { parameter: "force", name: "load" } }],
    },
  ],
});
