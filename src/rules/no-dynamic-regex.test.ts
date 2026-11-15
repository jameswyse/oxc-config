import { ruleTester } from "../shared/rule-tester.ts";
import { noDynamicRegex } from "./no-dynamic-regex.ts";

const error = { messageId: "dynamic" };

ruleTester.run("no-dynamic-regex", noDynamicRegex, {
  valid: [
    'const digits = new RegExp("[0-9]+", "g");',
    "const digits = RegExp(`[0-9]+`, flags);",
    "const copy = new RegExp(/[0-9]+/, flags);",
    "const empty = new RegExp();",
    "const term = new RegExp(RegExp.escape(input));",
    "const term = new RegExp(`^${RegExp.escape(prefix)}-${RegExp.escape(suffix)}$`, 'i');",
    "const term = new globalThis.RegExp(escapeRegExp(input));",
    'import escapeStringRegexp from "escape-string-regexp"; const term = new RegExp(escapeStringRegexp(input));',
    "const term = new RegExp(`\\\\b${_.escapeRegExp(word)}\\\\b`);",
    'const term = new RegExp("^" + escapeRegExp(prefix) + "$");',
    'const prefix = "user"; const term = new RegExp(`^${prefix}-[0-9]+$`);',
    'const base = "[a-z]+"; const full = base + "@" + base; const term = new RegExp(full);',
    'const term = new RegExp(RegExp["escape"](input));',
    'const term = new RegExp(words.map(escapeRegExp).join("|"));',
    'const term = new RegExp(`^(?:${words.map((word) => RegExp.escape(word)).join("|")})$`);',
    "const term = new RegExp(String.raw`^${escapeRegExp(prefix)}\\d+$`);",
    "class RegExp { constructor(pattern: string) {} } const term = new RegExp(input);",
    "const pattern = new Pattern(input);",
  ],
  invalid: [
    { code: "const term = new RegExp(input);", errors: [error] },
    { code: "const term = RegExp(input, 'g');", errors: [error] },
    { code: "const term = new globalThis.RegExp(config.pattern);", errors: [error] },
    { code: "const term = new RegExp(`^${prefix}-`);", errors: [error] },
    { code: "const term = new RegExp(`^${RegExp.escape(prefix)}-${suffix}`);", errors: [error] },
    { code: 'const term = new RegExp("^" + prefix);', errors: [error] },
    {
      code: 'let prefix = "user"; prefix = input; const term = new RegExp(prefix);',
      errors: [error],
    },
    { code: "const term = new RegExp(String(input));", errors: [error] },
    { code: 'const copy = new RegExp(pattern.source, "g");', errors: [error] },
    { code: "const term = new RegExp(request.body.source);", errors: [error] },
    { code: 'const term = new RegExp(words.join("|"));', errors: [error] },
    { code: "const term = new RegExp(words.map(escapeRegExp).join(separator));", errors: [error] },
    {
      code: 'const term = new RegExp(words.map((word) => word.trim()).join("|"));',
      errors: [error],
    },
    { code: "const term = new RegExp(String.raw`^${prefix}\\d+$`);", errors: [error] },
    { code: "const term = new RegExp(...parts);", errors: [error] },
    { code: "const term = new RegExp(escape(input));", errors: [error] },
    { code: "const term = new RegExp((input as string));", errors: [error] },
  ],
});
