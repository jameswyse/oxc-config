import { ruleTester } from "../shared/rule-tester.ts";
import { noSecretFallback } from "./no-secret-fallback.ts";

const error = { messageId: "fallback" };

ruleTester.run("no-secret-fallback", noSecretFallback, {
  valid: [
    'const port = process.env.PORT ?? "3000";',
    "const secret = verificationSecret.parse(process.env.VERIFY_EMAIL_SECRET);",
    "const token = process.env.API_TOKEN ?? fail('API_TOKEN is required');",
    'const { PORT = "3000" } = process.env;',
    'const keyboard = process.env.KEYBOARD_LAYOUT ?? "us";',
    'const process = { env: { SECRET: undefined } }; const secret = process.env.SECRET ?? "dev";',
  ],
  invalid: [
    {
      code: 'const key = process.env.VERIFY_EMAIL_SECRET || "example-default-key";',
      errors: [error],
    },
    { code: 'const token = process.env["GITHUB_TOKEN"] ?? "";', errors: [error] },
    { code: "const key = import.meta.env.VITE_STRIPE_API_KEY ?? `pk_test`;", errors: [error] },
    { code: 'const { JWT_SIGNING_KEY = "dev-key" } = process.env;', errors: [error] },
    { code: 'const password = process.env.DATABASE_PASSWORD || "postgres";', errors: [error] },
    { code: 'const secret = process["env"].SESSION_SECRET ?? "dev";', errors: [error] },
    {
      code: 'const secret = ((process as NodeJS.Process).env.SESSION_SECRET as string) || "dev";',
      errors: [error],
    },
    { code: 'const { ["JWT_SECRET"]: secret = "dev" } = process.env;', errors: [error] },
  ],
});
