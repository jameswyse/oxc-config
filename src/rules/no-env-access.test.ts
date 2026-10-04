import { ruleTester } from "../shared/rule-tester.ts";
import { noEnvAccess } from "./no-env-access.ts";

ruleTester.run("no-env-access", noEnvAccess, {
  valid: [
    "export function read(config: { port: number }) { return config.port; }",
    "function load(process: { env: string }) { return process.env; }",
    "const meta = import.meta.url;",
    "const env = config.env;",
  ],
  invalid: [
    { code: "const port = process.env.PORT;", errors: [{ messageId: "env" }] },
    { code: "const mode = import.meta.env.MODE;", errors: [{ messageId: "env" }] },
    { code: "const { env } = process;", errors: [{ messageId: "env" }] },
    { code: "const { env } = import.meta;", errors: [{ messageId: "env" }] },
    { code: "const values = { ...process.env };", errors: [{ messageId: "env" }] },
  ],
});
