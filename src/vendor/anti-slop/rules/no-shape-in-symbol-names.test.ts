// Adapted from dmmulroy/anti-slop
import { ruleTester } from "../../../shared/rule-tester.ts";
import { noForbiddenTermInSymbolNames } from "./no-shape-in-symbol-names.ts";

const error = { messageId: "forbiddenSymbolName" };
ruleTester.run("no-shape-in-symbol-names", noForbiddenTermInSymbolNames, {
  valid: [
    'import type { ZodRawShape } from "zod"; export type Fields = ZodRawShape;',
    "declare const schema: ExternalSchema; const field = schema.shape.id;",
    "declare const outer: External; const value = outer.inner.shape;",
    "declare const schema: ExternalSchema; schema.shape.id.parse('x');",
    "const owner = { id: 1 }; const value = owner.id;",
    {
      code: 'import { Shape } from "react-konva"; export const View = () => <Shape />;',
      filename: "view.tsx",
    },
  ],
  invalid: [
    {
      code: 'import type { ZodRawShape as Shape } from "zod"; export type Fields = Shape;',
      errors: 2,
    },
    {
      code: 'import { userShape } from "./user"; export const fields = userShape;',
      errors: 3,
    },
    { code: "const shape = 1;", errors: [error] },
    {
      code: 'import type { ZodRawShape } from "zod"; export const owner = { ZodRawShape: 1 }; export class Store { #ZodRawShape = 1; ZodRawShape() {} }',
      errors: 3,
    },
    { code: "function shapeOf() {}", errors: [error] },
    { code: "type PayloadShape = { id: string };", errors: [error] },
    { code: "type Payload = { shape: string };", errors: [error] },
    {
      code: "declare const owner: External; const shape = 'field'; const value = owner[shape];",
      errors: 2,
    },
  ],
});
