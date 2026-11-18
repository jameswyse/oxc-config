import { ruleTester } from "../shared/rule-tester.ts";
import { noInternalReturnTypes } from "./no-internal-return-types.ts";

function reported(code: string, output: string) {
  return {
    code,
    errors: [
      {
        messageId: "explicitReturnType",
        suggestions: [{ messageId: "removeReturnType", output }],
      },
    ],
  };
}

ruleTester.run("no-internal-return-types", noInternalReturnTypes, {
  valid: [
    "function get(): number { return 1; } const a = [get, b]; const b = [a]; export const api = [b];",
    "function total(items: number[]) { return items.length; }",
    "const total = (items: number[]) => items.length;",
    "function isUser(value: unknown): value is User { return value instanceof User; }",
    "class Node { isLeaf(): this is Leaf { return this.children.length === 0; } }",
    "function assertUser(value: unknown): asserts value is User { if (!(value instanceof User)) throw new Error(); }",
    "function assertDefined(value: unknown): asserts value { if (value == null) throw new Error(); }",
    "function fail(message: string): never { throw new Error(message); }",
    "const fail = (message: string): never => { throw new Error(message); };",
    "function parse(value: string): number; function parse(value: number): number; export function parse(value: string | number): number { return Number(value); }",
    "declare function load(id: string): Promise<User>;",
    "abstract class Store { abstract load(id: string): Promise<User>; }",
    "interface Store { load(id: string): Promise<User>; }",
    "type Loader = { load(id: string): Promise<User> };",
    "type Load = (id: string) => Promise<User>;",
    {
      code: "export declare function load(id: string): Promise<User>;",
      filename: "types.d.ts",
    },
    "export function total(items: number[]): number { return items.length; }",
    "export const total = (items: number[]): number => items.length;",
    "export const total = function (items: number[]): number { return items.length; };",
    "export default function total(items: number[]): number { return items.length; }",
    "export default (items: number[]): number => items.length;",
    "export const api = { total(items: number[]): number { return items.length; } };",
    "export const api = { total: (items: number[]): number => items.length };",
    "export const api = { nested: { total: (items: number[]): number => items.length } };",
    "export const api = { get size(): number { return 1; } };",
    "export const api = { total: (items: number[]): number => items.length } satisfies Api;",
    "export const api = ({ total: (items: number[]): number => items.length }) as Api;",
    "export const total = ((items: number[]): number => items.length)!;",
    "export class Cart { total(): number { return 1; } }",
    "export class Cart { get size(): number { return 1; } }",
    "export class Cart { static empty(): Cart { return new Cart(); } }",
    "export class Cart { total = (): number => 1; }",
    "export class Cart { accessor total = (): number => 1; }",
    "export default class { total(): number { return 1; } }",
    "export const Cart = class { total(): number { return 1; } };",
    "function total(items: number[]): number { return items.length; } export { total };",
    "function total(items: number[]): number { return items.length; } export { total as sum };",
    "function total(items: number[]): number { return items.length; } export { total as default };",
    "const total = (items: number[]): number => items.length; export { total };",
    "class Cart { total(): number { return 1; } } export { Cart as ShoppingCart };",
    "const api = { total(): number { return 1; } }; export { api };",
    "function total(items: number[]): number { return items.length; } export default total;",
    "export namespace Cart { export function total(): number { return 1; } }",
    "function depth(node: Tree): number { return node.child ? depth(node.child) + 1 : 0; }",
    "const depth = (node: Tree): number => (node.child ? depth(node.child) + 1 : 0);",
    "const depth = function walk(node: Tree): number { return node.child ? walk(node.child) + 1 : 0; };",
    'export const observe = Effect.fn("observe")(function* (): Effect.fn.Return<number> { return yield* load(); });',
    "export const sizes = items.map((item): number => item.size);",
    "export default items.map((item): number => item.size);",
    "export const api = { load: create((id: string): User => find(id)) };",
    "export const totals = [(): number => 1];",
    "export const pick = ready ? (): number => 1 : (): number => 2;",
    "export const handlers = [...defaults, { run: (): number => 1 }];",
    "export class Cart extends mixin((): Base => Base) {}",
    "function get(): number { return 1; } export const api = { get };",
    "const get = (): number => 1; export const api = { get };",
    "const get = memo((): number => 1); export const api = { get };",
    "function get(): number { return 1; } export default { get };",
    "function get(): number { return 1; } export const value = get();",
    "function get(): number { return 1; } export class Api { static get = get; }",
    "function get(): number { return 1; } const api = { get }; export { api };",
    "function get(): number { return 1; } const methods = { get }; export const api = methods;",
    "function get(): number { return 1; } const methods = { get }; const api = [methods]; export default api;",
    "const get = (): number => 1; const methods = { get }; const api = { methods }; export { api };",
    "class Cart { total(): number { return 1; } } export const cart = new Cart();",
    {
      code: "function parse(value: string): number { return Number(value); } export = parse;",
      filename: "parse.cts",
    },
    {
      code: "function parse(value: string): number { return Number(value); } export = parse;",
      filename: "parse.ts",
    },
    {
      code: "export = { parse(value: string): number { return Number(value); } };",
      filename: "parse.cts",
    },
    "class Tree { depth(node: Tree): number { return node.child ? this.depth(node.child) + 1 : 0; } }",
    "class Tree { depth = (node: Tree): number => (node.child ? this.depth(node.child) + 1 : 0); }",
    "class Tree { walk(): number { return items.map(() => this.walk()).length; } }",
    "class Tree { static walk(n: number): number { return n === 0 ? 0 : this.walk(n - 1); } }",
    "const tree = { walk(n: number): number { return n === 0 ? 0 : this.walk(n - 1); } };",
    "const tree = { walk(n: number): number { return n === 0 ? 0 : tree.walk(n - 1); } };",
    "const tree = { walk: (n: number): number => (n === 0 ? 0 : tree.walk(n - 1)) };",
    "const tree = { walk(n: number): number { return items.map(() => tree.walk(n - 1)).length; } };",
    "export class Cart { protected total(): number { return 1; } }",
    "export abstract class Shape { protected abstract area(): number; protected scaled(): number { return 1; } }",
    "class Tree { static depth(n: number): number { return n === 0 ? 0 : Tree.depth(n - 1) + 1; } }",
    "const Tree = class { static depth(n: number): number { return n === 0 ? 0 : Tree.depth(n - 1) + 1; } };",
    'function plan(message: string): Plan { return { _tag: "Refused", message }; }',
    "function stepFor(key: string): readonly [number, number] | null { if (key === '') { return null; } return [-1, 0]; }",
    "function nothing(): Item[] { return []; }",
    "function updater(): ((layout: ProjectLayout) => ProjectLayout) | null { return (current) => ({ ...current }); }",
    "function find(machine: Machine | undefined): Effect.Effect<Machine, NotFound> { return machine === undefined ? Effect.fail(notFound) : Effect.succeed(machine); }",
    "function find(machine: Machine | undefined): Effect.Effect<Machine, NotFound> { if (machine === undefined) { return Effect.fail(notFound); } return Effect.succeed(machine); }",
    "function load(): Promise<Map<string, number>> { return new Promise((settle) => settle(sizes)); }",
    "function empty(): Map<string, number> { return new Map(); }",
    "const policy = Option.getOrElse(current, (): ReadPolicy => ({ policy: { allowedTiers: [] } }));",
    "function failed(message: string): InspectionResult { return InspectionResult.cases.Failed.make({ message }); }",
    'function mode(flag: boolean): Mode { return flag ? "light" : "dark"; }',
    'function mode(value: Mode | undefined): Mode { return value ?? "light"; }',
    'async function mode(): Promise<Mode> { return "light"; }',
    'function label(): Effect.Effect<Mode> { return Effect.succeed("light"); }',
    "function handler(): Handler { return function (event) { return event.id; }; }",
    "function* ids(): Generator<number> { yield 1; }",
    'const call = Effect.fn("call")(function* (id: string): Effect.fn.Return<CallEnd, CallError> { return yield* end(id); });',
    'function plan(message: string): Plan { return { _tag: "Refused", message } satisfies Plan; }',
    "function step(n: number): `step-${number}` { return `step-${n}`; }",
    "function fail(message: string): Result { throw new Error(message); }",
    "async function wait(): Promise<number> { await sleep(); }",
    "function load(id: string): Effect.Effect<User, NotFound> { const stored = cache.get(id); if (stored) { return stored; } return Effect.fail(notFound); }",
    "async function load(id: string): Promise<User> { return cached ?? (await fetchUser(id)); }",
    "function config(raw: string): Config { return JSON.parse(raw); }",
    "function name(raw: string): string { return JSON.parse(raw); }",
    "async function user(response: Response): Promise<User> { return response.json(); }",
    "function load(id: string): Effect.Effect<Plan> { return client?.load({ id }); }",
    "function failed(): -1 | 1 { return -1; }",
    'async function read(): Promise<string> { return new Promise((resolve) => resolve("ready")); }',
    "function count(raw: string): number { return JSON.parse(raw).count; }",
    "async function data(response: Response): Promise<Data> { return (await response.json()).data; }",
    "async function data(response: Response): Promise<Data> { const body = await response.json(); return body; }",
    "async function read(response: Response): Promise<string> { const { name } = await response.json(); return name; }",
    "async function read(response: Response): Promise<string> { const { name } = (await response.json()) ?? {}; return name; }",
    "function read(raw: string): string { const name = JSON.parse(raw) satisfies string; return name; }",
    'function tags(): [string] { return ["tag"]!; }',
    "function list(flag: boolean): (string | number)[] { if (flag) { const data = { list: [1] }; return data.list; } const data = { list: ['a'] }; return data.list; }",
    "function choose(flag: boolean): (string | number)[] { if (flag) { const result = [1]; return result; } const result = ['a']; return result; }",
  ],
  invalid: [
    reported(
      "class Tree { depth(n: number): number { return n === 0 ? 0 : Tree.depth(n - 1) + 1; } }",
      "class Tree { depth(n: number) { return n === 0 ? 0 : Tree.depth(n - 1) + 1; } }",
    ),
    reported(
      "class Tree { static depth(n: number): number { const Tree = other; return Tree.depth(n); } }",
      "class Tree { static depth(n: number) { const Tree = other; return Tree.depth(n); } }",
    ),
    reported(
      "function depth(node: Tree): number { return 0; } const other = (node: Tree) => depth(node);",
      "function depth(node: Tree) { return 0; } const other = (node: Tree) => depth(node);",
    ),
    reported(
      "function outer(node: Tree): number { function depth(): number { return outer(node); } return depth(); }",
      "function outer(node: Tree): number { function depth() { return outer(node); } return depth(); }",
    ),
    reported(
      "function total(items: number[]): number { return items.length; }",
      "function total(items: number[]) { return items.length; }",
    ),
    reported(
      "const total = function (items: number[]): number { return items.length; };",
      "const total = function (items: number[]) { return items.length; };",
    ),
    reported(
      "const total = (items: number[]): number => items.length;",
      "const total = (items: number[]) => items.length;",
    ),
    reported(
      "class Cart { total(): number { return 1; } }",
      "class Cart { total() { return 1; } }",
    ),
    reported(
      "class Cart { get size(): number { return 1; } }",
      "class Cart { get size() { return 1; } }",
    ),
    reported("class Cart { total = (): number => 1; }", "class Cart { total = () => 1; }"),
    reported(
      "const api = { total(): number { return 1; } };",
      "const api = { total() { return 1; } };",
    ),
    reported(
      "const api = { get size(): number { return 1; } };",
      "const api = { get size() { return 1; } };",
    ),
    reported(
      "async function load(id: string): Promise<User> { return fetchUser(id); }",
      "async function load(id: string) { return fetchUser(id); }",
    ),
    reported(
      "async function data(response: Response): Promise<Data> { const body: Data = await response.json(); return body; }",
      "async function data(response: Response) { const body: Data = await response.json(); return body; }",
    ),
    reported(
      "function config(raw: string): Config { return JSON.parse(raw) as Config; }",
      "function config(raw: string) { return JSON.parse(raw) as Config; }",
    ),
    reported(
      'function sentences(parts: string[]): string { return parts.filter((part) => part !== "").join(". "); }',
      'function sentences(parts: string[]) { return parts.filter((part) => part !== "").join(". "); }',
    ),
    reported(
      "async function load(response: TypedResponse): Promise<Data> { return response.json<Data>(); }",
      "async function load(response: TypedResponse) { return response.json<Data>(); }",
    ),
    reported(
      "async function read(response: Response): Promise<string> { const { name }: { name: string } = await response.json(); return name; }",
      "async function read(response: Response) { const { name }: { name: string } = await response.json(); return name; }",
    ),
    reported(
      "function pick(value: Date, flag: boolean): Date { if (flag) { log(); return value; } return value; }",
      "function pick(value: Date, flag: boolean) { if (flag) { log(); return value; } return value; }",
    ),
    reported(
      "function log(message: string): void { console.log(message); }",
      "function log(message: string) { console.log(message); }",
    ),
    reported(
      "async function readSession(response: Response): Promise<Session> { return decodeSession(await response.json()); }",
      "async function readSession(response: Response) { return decodeSession(await response.json()); }",
    ),
    reported(
      "async function check(root: string): Promise<string | null> { if (root === '') { return `${root} is missing`; } return null; }",
      "async function check(root: string) { if (root === '') { return `${root} is missing`; } return null; }",
    ),
    reported(
      "async function save(): Promise<void> { await write(); }",
      "async function save() { await write(); }",
    ),
    reported(
      "function find(id: string): User | undefined { if (id === '') { return undefined; } return users.get(id); }",
      "function find(id: string) { if (id === '') { return undefined; } return users.get(id); }",
    ),
    reported(
      "function find(id: string): User | null { return id === '' ? null : users.get(id); }",
      "function find(id: string) { return id === '' ? null : users.get(id); }",
    ),
    reported('function mode(): string { return "light"; }', 'function mode() { return "light"; }'),
    reported(
      "function size(flag: boolean): number | null { return flag ? 1 : null; }",
      "function size(flag: boolean) { return flag ? 1 : null; }",
    ),
    reported(
      "function count(flag: boolean): number { return flag ? load() : save(); }",
      "function count(flag: boolean) { return flag ? load() : save(); }",
    ),
    reported(
      "function find(id: string): Effect.Effect<User, NotFound> { return users.get(id); }",
      "function find(id: string) { return users.get(id); }",
    ),
    reported(
      "function ids(items: Item[]): string[] { return items.map((item: Item) => item.id); }",
      "function ids(items: Item[]) { return items.map((item: Item) => item.id); }",
    ),
    reported(
      "function load(): Effect.Effect<User> { return Effect.gen(function* () { return yield* find(); }); }",
      "function load() { return Effect.gen(function* () { return yield* find(); }); }",
    ),
    reported(
      "function users(): Map<string, User> { return new Map<string, User>(); }",
      "function users() { return new Map<string, User>(); }",
    ),
    reported(
      "function pick(): Pair { return [first, second] as const; }",
      "function pick() { return [first, second] as const; }",
    ),
    reported(
      "function total(items: number[]): number | undefined { return items[0]; }",
      "function total(items: number[]) { return items[0]; }",
    ),
    reported(
      "export function makeTotal() { return (items: number[]): number => items.length; }",
      "export function makeTotal() { return (items: number[]) => items.length; }",
    ),
    reported(
      "export function outer(): void { function inner(): number { return 1; } inner(); }",
      "export function outer(): void { function inner() { return 1; } inner(); }",
    ),
    reported(
      "export const outer = (): void => { const inner = (): number => 1; inner(); };",
      "export const outer = (): void => { const inner = () => 1; inner(); };",
    ),
    reported(
      "export class Cart { private total(): number { return 1; } }",
      "export class Cart { private total() { return 1; } }",
    ),
    reported(
      "export class Cart { #total(): number { return 1; } }",
      "export class Cart { #total() { return 1; } }",
    ),
    reported(
      "export class Cart { private total = (): number => 1; }",
      "export class Cart { private total = () => 1; }",
    ),
    reported(
      "export class Cart { load() { return items.map((item): number => item.size); } }",
      "export class Cart { load() { return items.map((item) => item.size); } }",
    ),
    reported(
      "function total(): number { return 1; } export { other };",
      "function total() { return 1; } export { other };",
    ),
    reported(
      "function total(): number { return 1; } export { total } from './total';",
      "function total() { return 1; } export { total } from './total';",
    ),
    reported(
      "export function outer() { function total(): number { return 1; } return total; } export { total };",
      "export function outer() { function total() { return 1; } return total; } export { total };",
    ),
    reported(
      "export const { total = (): number => 1 } = options;",
      "export const { total = () => 1 } = options;",
    ),
    reported(
      "export const sizes = items.map((item) => { const size = (): number => item.size; return size(); });",
      "export const sizes = items.map((item) => { const size = () => item.size; return size(); });",
    ),
    reported(
      "export const handler = wrap(function () { return (): number => 1; });",
      "export const handler = wrap(function () { return () => 1; });",
    ),
    reported(
      "@register((): number => 1) export class Cart {}",
      "@register(() => 1) export class Cart {}",
    ),
    reported(
      "function get(): number { return 1; } export function api() { return { get }; }",
      "function get() { return 1; } export function api() { return { get }; }",
    ),
    reported(
      "function get(): number { return 1; } export const api = { run: () => get() };",
      "function get() { return 1; } export const api = { run: () => get() };",
    ),
    reported(
      "function get(): number { return 1; } export type Get = typeof get;",
      "function get() { return 1; } export type Get = typeof get;",
    ),
    reported(
      "function get(): number { return 1; } const api = { get };",
      "function get() { return 1; } const api = { get };",
    ),
    reported(
      "function get(): number { return 1; } const methods = { get }; const api = methods;",
      "function get() { return 1; } const methods = { get }; const api = methods;",
    ),
    reported(
      "function get(): number { return 1; } const methods = { get }; export const api = () => methods;",
      "function get() { return 1; } const methods = { get }; export const api = () => methods;",
    ),
    reported(
      "function get(): number { return 1; } const a = [get, b]; const b = [a];",
      "function get() { return 1; } const a = [get, b]; const b = [a];",
    ),
    reported(
      "function get(): number { return 1; } export const api = { get: other };",
      "function get() { return 1; } export const api = { get: other };",
    ),
    reported(
      "function parse(value: string): number { return Number(value); } export = other;",
      "function parse(value: string) { return Number(value); } export = other;",
    ),
    reported(
      "class Tree { depth(): number { return this.size(); } }",
      "class Tree { depth() { return this.size(); } }",
    ),
    reported(
      "class Tree { depth(): number { return this.depth; } }",
      "class Tree { depth() { return this.depth; } }",
    ),
    reported(
      "class Tree { depth(): number { return [1].map(function () { return this.depth(); }).length; } }",
      "class Tree { depth() { return [1].map(function () { return this.depth(); }).length; } }",
    ),
    reported(
      "const tree = { walk: (n: number): number => this.walk(n) };",
      "const tree = { walk: (n: number) => this.walk(n) };",
    ),
    reported(
      "const tree = { walk(n: number): number { return other.walk(n); } };",
      "const tree = { walk(n: number) { return other.walk(n); } };",
    ),
    reported(
      "const tree = { walk(n: number): number { return tree.size(n); } };",
      "const tree = { walk(n: number) { return tree.size(n); } };",
    ),
    {
      code: "function even(n: number): boolean { return n === 0 || odd(n - 1); } function odd(n: number): boolean { return n !== 0 && even(n - 1); }",
      errors: [
        {
          messageId: "explicitReturnType",
          suggestions: [
            {
              messageId: "removeReturnType",
              output:
                "function even(n: number) { return n === 0 || odd(n - 1); } function odd(n: number): boolean { return n !== 0 && even(n - 1); }",
            },
          ],
        },
        {
          messageId: "explicitReturnType",
          suggestions: [
            {
              messageId: "removeReturnType",
              output:
                "function even(n: number): boolean { return n === 0 || odd(n - 1); } function odd(n: number) { return n !== 0 && even(n - 1); }",
            },
          ],
        },
      ],
    },
  ],
});
