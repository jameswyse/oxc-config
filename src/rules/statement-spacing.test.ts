import { ruleTester } from "../shared/rule-tester.ts";
import { statementSpacing } from "./statement-spacing.ts";

ruleTester.run("statement-spacing", statementSpacing, {
  valid: [
    "import { a } from 'a';\nimport type { B } from 'b';\n\nexport const c = a;",
    "const a = 1;\nconst b = 2;\nexport const c = 3;\nexport const d = 4;",
    "const A = make({\n  a: 1,\n});\ntype A = typeof A;",
    "export const A = make({\n  a: 1,\n});\nexport type A = typeof A;",
    "function f() {\n  const a = 1;\n  const b = 2;\n\n  return a + b;\n}",
  ],
  invalid: [
    {
      code: "import { a } from 'a';\nconst b = a;",
      output: "import { a } from 'a';\n\nconst b = a;",
      errors: [{ messageId: "expectedBlankLine" }],
    },
    {
      code: "export const A = make({\n  a: 1,\n});\nexport const b = 2;",
      output: "export const A = make({\n  a: 1,\n});\n\nexport const b = 2;",
      errors: [{ messageId: "expectedBlankLine" }],
    },
    {
      code: "export const b = 2;\nexport const A = make({\n  a: 1,\n});",
      output: "export const b = 2;\n\nexport const A = make({\n  a: 1,\n});",
      errors: [{ messageId: "expectedBlankLine" }],
    },
    {
      code: "export function a() {\n  return 1;\n}\nexport const b = 2;",
      output: "export function a() {\n  return 1;\n}\n\nexport const b = 2;",
      errors: [{ messageId: "expectedBlankLine" }],
    },
    {
      code: "it('runs', () => {\n  const result = run({\n    a: 1,\n  });\n  expect(result).toBe(1);\n});",
      output:
        "it('runs', () => {\n  const result = run({\n    a: 1,\n  });\n\n  expect(result).toBe(1);\n});",
      errors: [{ messageId: "expectedBlankLine" }],
    },
    {
      code: "function f() {\n  const a = 1;\n  return a;\n}",
      output: "function f() {\n  const a = 1;\n\n  return a;\n}",
      errors: [{ messageId: "expectedBlankLine" }],
    },
  ],
});
