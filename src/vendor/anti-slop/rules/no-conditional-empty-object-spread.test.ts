// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noConditionalEmptyObjectSpread } from "./no-conditional-empty-object-spread.ts";

const error = { messageId: "avoid" };

if (noConditionalEmptyObjectSpread.meta?.fixable !== void 0) {
  throw new Error("The rule must not offer an unsafe semantics-changing fix.");
}

ruleTester.run("no-conditional-empty-object-spread", noConditionalEmptyObjectSpread, {
  valid: [
    "const result = { value };",
    "const result = { ...values };",
    "const result = condition ? { value } : {};",
  ],
  invalid: [
    { code: "const result = { ...(value !== undefined ? { value } : {}) };", errors: [error] },
    { code: "const result = { ...(condition ? {} : { value }) };", errors: [error] },
  ],
});
