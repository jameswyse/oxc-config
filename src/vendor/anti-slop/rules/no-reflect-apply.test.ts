// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noReflectApply } from "./no-reflect-apply.ts";

const error = { messageId: "reflectApply" };
ruleTester.run("no-reflect-apply", noReflectApply, {
  valid: [
    "const value = operation.apply(owner, args);",
    "Reflect.get(owner, key);",
    "const Reflect = { apply() { return 1; } }; Reflect.apply();",
    "function invoke(Reflect: { apply(): number }) { return Reflect.apply(); }",
  ],
  invalid: [
    { code: "const value = Reflect.apply(operation, owner, args);", errors: [error] },
    { code: "const value = Reflect['apply'](operation, owner, args);", errors: [error] },
  ],
});
