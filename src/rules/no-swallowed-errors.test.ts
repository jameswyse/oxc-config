import { ruleTester } from "../shared/rule-tester.ts";
import { noSwallowedErrors } from "./no-swallowed-errors.ts";

ruleTester.run("no-swallowed-errors", noSwallowedErrors, {
  valid: [
    "function run() { try { load(); } catch {} }",
    "function run() { try { return load(); } catch (error) { report(error); return null; } }",
    "function run() { try { return load(); } catch (error) { return error instanceof Missing ? null : fail(error); } }",
    "function run() { try { return load(); } catch { return [1]; } }",
    "function run() { try { return load(); } catch { return fallback; } }",
    "function run() { try { return load(); } catch { throw new LoadError(); } }",
    "async function run() { try { await save(); } catch { return true; } }",
    "function parse(text: string) { try { return JSON.parse(text); } catch { return null; } }",
    "function parse(value: string) { try { const url = new URL(value); return url.protocol === 'https:' ? url : undefined; } catch { return undefined; } }",
    "function decode(value: string) { try { return decodeURIComponent(value); } catch { return null; } }",
    "function isZone(value: string) { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }",
    'import { readFile } from "node:fs/promises"; async function read(path: string) { try { return await readFile(path, "utf8"); } catch { return ""; } }',
    'import { statSync } from "node:fs"; function exists(path: string) { try { return statSync(path).isFile(); } catch { return false; } }',
    'import { stat } from "node:fs/promises"; async function find(path: string) { return stat(path).catch(() => null); }',
    'import fs from "node:fs"; async function list(path: string) { return fs.promises.readdir(path).catch(() => []); }',
    "void promise.catch(() => undefined);",
    "async function next() { await previous?.catch(() => undefined); }",
    "void operation.finally(cleanup).catch(() => undefined);",
    "async function body(response: Response) { return response.json().catch(() => null); }",
    "load().catch((error) => report(error));",
    "load().catch(() => fallback);",
    "load().catch(handle);",
    "load().catch((error) => { report(error); return null; });",
  ],
  invalid: [
    {
      code: "function run() { try { return load(); } catch { return null; } }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "function run() { try { return load(); } catch (error) { return []; } }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "function run() { try { save(); } catch { return; } }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "function run() { try { return load(); } catch { return {} as Config; } }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "function run() { try { return load(); } catch { return void 0; } }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "function run() { try { return load(); } catch { return ``; } }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "async function run() { try { return JSON.parse(await fetchText()); } catch { return null; } }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: "const JSON = custom; function parse(text: string) { try { return JSON.parse(text); } catch { return null; } }",
      errors: [{ messageId: "swallowed" }],
    },
    {
      code: 'import { stat } from "./files"; async function find(path: string) { return stat(path).catch(() => null); }',
      errors: [{ messageId: "swallowed" }],
    },
    { code: "load().catch(() => undefined);", errors: [{ messageId: "swallowed" }] },
    { code: "load().catch(() => {});", errors: [{ messageId: "swallowed" }] },
    { code: "load().catch((error) => { return false; });", errors: [{ messageId: "swallowed" }] },
    { code: "load().then(show).catch(() => null);", errors: [{ messageId: "swallowed" }] },
    { code: "void sync(view).catch(async () => 0);", errors: [{ messageId: "swallowed" }] },
  ],
});
