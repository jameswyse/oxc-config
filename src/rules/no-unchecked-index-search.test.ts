import { ruleTester } from "../shared/rule-tester.ts";
import { noUncheckedIndexSearch } from "./no-unchecked-index-search.ts";

const error = { messageId: "unchecked" };

ruleTester.run("no-unchecked-index-search", noUncheckedIndexSearch, {
  valid: [
    "const index = items.indexOf(item); if (index >= 0) { items.splice(index, 1); }",
    "const name = path.slice(path.lastIndexOf('/') + 1);",
    "const head = text.substring(0, text.indexOf(':'));",
    "items.splice(0, items.indexOf(item));",
    "const position = items.indexOf(item);",
  ],
  invalid: [
    { code: "items.splice(items.indexOf(item), 1);", errors: [error] },
    {
      code: "const next = items.toSpliced(items.findIndex((entry) => entry.id === id), 1);",
      errors: [error],
    },
    { code: "const next = items.with(items.indexOf(item), replacement);", errors: [error] },
    { code: "const path = url.slice(0, url.indexOf('?'));", errors: [error] },
    { code: "const last = items.at(items.findLastIndex(isOpen));", errors: [error] },
    { code: "items['splice'](items['indexOf'](item) as number, 1);", errors: [error] },
  ],
});
