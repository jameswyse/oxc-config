import { ruleTester } from "../shared/rule-tester.ts";
import { noHardcodedCredential } from "./no-hardcoded-credential.ts";

const error = { messageId: "credential" };

function assembled(...parts: string[]): string {
  return parts.join("");
}

ruleTester.run("no-hardcoded-credential", noHardcodedCredential, {
  valid: [
    'export const accessKeyId = "AKIAIOSFODNN7EXAMPLE";',
    "export const token = process.env.GITHUB_TOKEN;",
    'export const prefix = "ghp_";',
    'export const header = "-----BEGIN PUBLIC KEY-----";',
    `export const key = "${assembled("sk_", "test_", "51Hx9Qw2Lm4Rt7Vb3Np8Ks6Dz")}";`,
    `export const fake = "${assembled("ghp_", "x".repeat(36))}";`,
    `export const sample = "${assembled("sk-", "proj-", "abcdefghijklmnopqrstuvwxyz123456")}";`,
    `export const key = \`${assembled("-----BEGIN ", "PRIVATE KEY-----")}\\nfake\\n-----END PRIVATE KEY-----\`;`,
  ],
  invalid: [
    { code: `export const id = "${assembled("AKIA", "2OGYBAH6STMJRN4K")}";`, errors: [error] },
    {
      code: `export const body = '{"note":"example request","token":"${assembled("ghp_", "R8x3kQm2Vn7Lp4Tz9Wc1Yb6Hd5Jf0Gs8Ae2Ku")}"}';`,
      errors: [error],
    },
    {
      code: `export const token = "${assembled("ghp_", "R8x3kQm2Vn7Lp4Tz9Wc1Yb6Hd5Jf0Gs8Ae2Ku")}";`,
      errors: [error],
    },
    {
      code: `export const tokens = "${assembled("ghp_", "EXAMPLE0000000000000000000000000000000")} ${assembled("ghp_", "R8x3kQm2Vn7Lp4Tz9Wc1Yb6Hd5Jf0Gs8Ae2Ku")}";`,
      errors: [error],
    },
    {
      code: `export const key = \`${assembled("-----BEGIN RSA ", "PRIVATE KEY-----")}\\nMIIEowIBAAKCAQEA\`;`,
      errors: [error],
    },
    {
      code: `export const stripe = "${assembled("sk_", "live_", "51Hx9Qw2Lm4Rt7Vb3Np8Ks6Dz")}";`,
      errors: [error],
    },
  ],
});
