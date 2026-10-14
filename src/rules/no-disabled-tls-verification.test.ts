import { ruleTester } from "../shared/rule-tester.ts";
import { noDisabledTlsVerification } from "./no-disabled-tls-verification.ts";

const error = { messageId: "disabled" };

ruleTester.run("no-disabled-tls-verification", noDisabledTlsVerification, {
  valid: [
    "export const agent = new Agent({ ca: certificate, rejectUnauthorized: true });",
    "export const agent = new Agent({ rejectUnauthorized: options.strict });",
    'process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";',
    'const process = { env: {} }; process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";',
  ],
  invalid: [
    {
      code: "export const agent = new https.Agent({ rejectUnauthorized: false });",
      errors: [error],
    },
    { code: "const client = new Client({ ssl: { rejectUnauthorized: false } });", errors: [error] },
    { code: 'process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";', errors: [error] },
    { code: 'process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";', errors: [error] },
    {
      code: '(process as NodeJS.Process)["env"].NODE_TLS_REJECT_UNAUTHORIZED = "0";',
      errors: [error],
    },
    {
      code: 'export const agent = new Agent({ ["rejectUnauthorized"]: false as const });',
      errors: [error],
    },
  ],
});
