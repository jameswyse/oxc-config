import { ruleTester } from "../shared/rule-tester.ts";
import { noGenericFileSuffix } from "./no-generic-file-suffix.ts";

const code = "export const value = 1;";

ruleTester.run("no-generic-file-suffix", noGenericFileSuffix, {
  valid: [
    { code, filename: "/project/src/quoteEligibility.ts" },
    { code, filename: "/project/src/utils.ts" },
    { code, filename: "/project/src/householdPolicyMessages.ts" },
    { code, filename: "/project/src/policyCommands.ts" },
    { code, filename: "/project/src/contracting.ts" },
    { code, filename: "/project/src/paymentPolicy.test.ts" },
    { code, filename: "/project/src/payment.contract.stories.tsx" },
    { code, filename: "/project/src/security/contentSecurityPolicy.ts" },
    { code, filename: "/project/src/security/applicationContentSecurityPolicy.ts" },
    { code, filename: "/project/src/security/referrer-policy.ts" },
    {
      code: "export const AgentPolicy = Schema.Struct({}); export function loadPolicy() {}",
      filename: "/project/src/agentPolicy.ts",
    },
    {
      code: "type PaymentContract = string; export type { PaymentContract };",
      filename: "/project/src/PaymentContract.ts",
    },
  ],
  invalid: [
    "paymentPolicy.ts",
    "PaymentContract.tsx",
    "policy.ts",
    "contract.mjs",
    "payment-policy.ts",
    "payment_contract.ts",
    "payment.policy.ts",
    "paymentContract.d.ts",
  ].map((name) => ({
    code,
    filename: `/project/src/${name}`,
    errors: [{ messageId: "suffix" }],
  })),
});
