import { ruleTester } from "../shared/rule-tester.ts";
import { noDeepTernary } from "./no-deep-ternary.ts";

ruleTester.run("no-deep-ternary", noDeepTernary, {
  valid: [
    "const result = ready ? value : fallback;",
    "const result = first ? one : second ? two : three;",
    "const result = first ? (second ? one : two) : three;",
    "const result = (first ? one : two) ? three : four;",
    "const result = first ? second ? one : two : third ? three : four;",
    "const result = first ? one : second ? two : values.map(value => value ? three : four);",
    "const result = first ? one : second ? two : function value() { return third ? three : fourth ? four : five; };",
    "const result = first ? one : second ? two : { value() { return third ? three : fourth ? four : five; } };",
  ],
  invalid: [
    {
      code: "const result = first ? one : second ? two : third ? three : four;",
      errors: [{ messageId: "depth" }],
    },
    {
      code: "const result = first ? (second ? (third ? one : two) : three) : four;",
      errors: [{ messageId: "depth" }],
    },
    {
      code: "const result = ((first ? one : two) ? three : four) ? five : six;",
      errors: [{ messageId: "depth" }],
    },
    {
      code: "const result = first ? one : values.map(value => value ? two : third ? three : fourth ? four : five);",
      errors: [{ messageId: "depth" }],
    },
    {
      code: "const result = first ? one : second ? two : third ? three : fourth ? four : five;",
      errors: [{ messageId: "depth" }],
    },
    {
      code: "function choose() { return first ? one : second ? two : third ? three : fourth ? four : fifth ? five : six; }",
      errors: [{ messageId: "depth" }],
    },
  ],
});
