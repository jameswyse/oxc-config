// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noWidenThenAssert } from "./no-widen-then-assert.ts";

const error = { messageId: "widenThenAssert" };
ruleTester.run("no-widen-then-assert", noWidenThenAssert, {
  valid: [
    "const source = { id: 'first' }; const widened: unknown = source;",
    "declare const input: unknown; const parsed = input as { readonly id: string };",
  ],
  invalid: [
    {
      code: "const source = { id: 'second' }; const widened: unknown = source; const parsed = widened as { readonly id: string };",
      errors: [error],
    },
  ],
});
