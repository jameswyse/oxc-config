// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noForbiddenTermInSymbolNames } from "./no-shape-in-symbol-names.ts";

const error = { messageId: "forbiddenSymbolName" };
ruleTester.run("no-shape-in-symbol-names", noForbiddenTermInSymbolNames, {
  valid: [
    "declare const schema: ExternalSchema; const field = schema.shape.id;",
    "declare const outer: External; const value = outer.inner.shape;",
    "declare const schema: ExternalSchema; schema.shape.id.parse('x');",
    "const owner = { id: 1 }; const value = owner.id;",
  ],
  invalid: [
    { code: "const shape = 1;", errors: [error] },
    { code: "function shapeOf() {}", errors: [error] },
    { code: "type PayloadShape = { id: string };", errors: [error] },
    { code: "type Payload = { shape: string };", errors: [error] },
    {
      code: "declare const owner: External; const shape = 'field'; const value = owner[shape];",
      errors: 2,
    },
  ],
});
