// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noReflectGet } from "./no-reflect-get.ts";

const error = { messageId: "reflectGet" };
ruleTester.run("no-reflect-get", noReflectGet, {
  valid: [
    "const value = owner.property;",
    "const value = owner[key];",
    "Reflect.set(owner, key, value);",
    "const Reflect = { get() { return 1; } }; Reflect.get();",
    "function read(Reflect: { get(): number }) { return Reflect.get(); }",
  ],
  invalid: [
    { name: "static access", code: "const value = Reflect.get(owner, key);", errors: [error] },
    { name: "computed access", code: "const value = Reflect['get'](owner, key);", errors: [error] },
  ],
});
