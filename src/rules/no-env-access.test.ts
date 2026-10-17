import { ruleTester } from "../shared/rule-tester.ts";
import { noEnvAccess } from "./no-env-access.ts";

ruleTester.run("no-env-access", noEnvAccess, {
  valid: [
    "const a = b; const b = a; const port = a.env.PORT;",
    "export function read(config: { port: number }) { return config.port; }",
    "function load(process: { env: string }) { return process.env; }",
    "const meta = import.meta.url;",
    "const env = config.env;",
    "const process = { env: {} }; const mode = process.env;",
    'import { argv } from "node:process"; const args = argv.slice(2);',
    'import process from "node:process"; process.exitCode = 1;',
    'import * as p from "node:process"; const args = p.argv;',
    'import type { env } from "node:process"; type Env = typeof env;',
    'import process from "./process"; const mode = process.env.MODE;',
    'import { env } from "./config"; const mode = env.MODE;',
    'const { argv } = await import("node:process");',
    'const { env } = await import("./config");',
    'const key = Reflect.get(process, "argv");',
    "const key = Reflect.get(process, `${name}`);",
    "const port = process[`${name}`].PORT;",
    'function read(process: object) { return Reflect.get(process, "env"); }',
    'window.process = { env: { theme: "dark" } }; const theme = window.process.env.theme;',
    "const theme = self.process.env.theme;",
    "const window = { process: { env: {} } }; const port = window.process.env.PORT;",
    'export { argv } from "node:process";',
    'export { argv as args, exit } from "process";',
    'export type { env } from "node:process";',
    'export { type env } from "node:process";',
    'export type * from "node:process";',
    'export { env } from "./config";',
    'export * from "./config";',
  ],
  invalid: [
    { code: "const port = process.env.PORT;", errors: [{ messageId: "env" }] },
    { code: "const mode = import.meta.env.MODE;", errors: [{ messageId: "env" }] },
    { code: "const { env } = process;", errors: [{ messageId: "env" }] },
    { code: "const { env } = import.meta;", errors: [{ messageId: "env" }] },
    { code: "const values = { ...process.env };", errors: [{ messageId: "env" }] },
    { code: 'const port = process["env"].PORT;', errors: [{ messageId: "env" }] },
    { code: "const port = globalThis.process.env.PORT;", errors: [{ messageId: "env" }] },
    { code: "const port = global.process.env.PORT;", errors: [{ messageId: "env" }] },
    { code: 'const values = Reflect.get(process, "env");', errors: [{ messageId: "env" }] },
    {
      code: 'import { env } from "node:process"; const port = env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import { env as e } from "process"; const port = e.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import process from "node:process"; const port = process.env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import { default as proc } from "node:process"; const port = proc.env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import * as p from "node:process"; const port = p.env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import * as p from "node:process"; const port = p.default.env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import process from "node:process"; const { env } = process;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import process from "node:process"; const values = Reflect.get(process, "env");',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import { env } from "node:process"; function read(env: object) { return env; }',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const port = (await import("node:process")).env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const { env } = await import("node:process");',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const p = await import("node:process"); const port = p.env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const { default: process } = await import("process"); const port = process.env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const { default: p = {} } = await import("node:process"); const port = p.env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import process from "node:process"; const proc = process; const port = proc.env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'import p from "node:process"; const port = (p as typeof p).env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: "const port = (process as NodeJS.Process).env.PORT;",
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const values = Reflect.get(process!, "env");',
      errors: [{ messageId: "env" }],
    },
    {
      code: "const mode = (import.meta as ImportMeta).env.MODE;",
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const port = globalThis["process"].env.PORT;',
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const values = Reflect["get"](process, "env");',
      errors: [{ messageId: "env" }],
    },
    {
      code: "const values = Reflect.get(process, `env`);",
      errors: [{ messageId: "env" }],
    },
    {
      code: "const port = process[`env`].PORT;",
      errors: [{ messageId: "env" }],
    },
    {
      code: 'const { env } = await (import("node:process") as Promise<Process>);',
      languageOptions: { sourceType: "module" },
      errors: [{ messageId: "env" }],
    },
    { code: 'export { env } from "node:process";', errors: [{ messageId: "env" }] },
    { code: 'export { env as e } from "process";', errors: [{ messageId: "env" }] },
    { code: 'export { "env" as e } from "node:process";', errors: [{ messageId: "env" }] },
    { code: 'export { default } from "node:process";', errors: [{ messageId: "env" }] },
    { code: 'export { default as p } from "process";', errors: [{ messageId: "env" }] },
    {
      code: 'export { argv, env as environment } from "node:process";',
      errors: [{ messageId: "env", column: 15 }],
    },
    { code: 'export * as p from "node:process";', errors: [{ messageId: "env" }] },
    { code: 'export * from "process";', errors: [{ messageId: "env" }] },
  ],
});
