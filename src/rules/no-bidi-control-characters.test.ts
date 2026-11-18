import { ruleTester } from "../shared/rule-tester.ts";
import { noBidiControlCharacters } from "./no-bidi-control-characters.ts";

function control(codePoint: number) {
  return String.fromCodePoint(codePoint);
}

ruleTester.run("no-bidi-control-characters", noBidiControlCharacters, {
  valid: [
    'const isAdmin = role === "admin";',
    String.raw`const override = "\u202E";`,
    "const greeting = 'שלום';",
    `const mark = "${control(0x200f)}";`,
  ],
  invalid: [
    {
      code: `const access = "user${control(0x202e)} ${control(0x2066)}// admin${control(0x2069)} ${control(0x2066)}";`,
      errors: [
        { messageId: "control", data: { hex: "202E" }, column: 20, endColumn: 21 },
        { messageId: "control", data: { hex: "2066" }, column: 22 },
        { messageId: "control", data: { hex: "2069" }, column: 31 },
        { messageId: "control", data: { hex: "2066" }, column: 33 },
      ],
    },
    {
      code: `/*${control(0x202a)} } if (isAdmin) {${control(0x202c)} */\nexport const value = 1;`,
      errors: [
        { messageId: "control", data: { hex: "202A" }, line: 1, column: 2 },
        { messageId: "control", data: { hex: "202C" }, line: 1, column: 20 },
      ],
    },
    {
      code: `const a = 1;\n// ${control(0x202b)}${control(0x202d)}${control(0x2067)}${control(0x2068)}`,
      errors: [
        { messageId: "control", data: { hex: "202B" }, line: 2, column: 3 },
        { messageId: "control", data: { hex: "202D" }, line: 2, column: 4 },
        { messageId: "control", data: { hex: "2067" }, line: 2, column: 5 },
        { messageId: "control", data: { hex: "2068" }, line: 2, column: 6 },
      ],
    },
  ],
});
