import { defineRule } from "@oxlint/plugins";

const bidiControl = /[\u202A-\u202E\u2066-\u2069]/gu;

export const noBidiControlCharacters = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow Unicode bidirectional control characters in source files." },
    schema: [],
    messages: {
      control:
        "This invisible U+{{hex}} bidirectional control character can make code display differently from how it runs. Remove it, or write it as the escape `\\u{{hex}}` inside a string.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      Program() {
        for (const match of sourceCode.text.matchAll(bidiControl)) {
          const hex = match[0].charCodeAt(0).toString(16).toUpperCase();

          context.report({
            node: { range: [match.index, match.index + match[0].length] },
            messageId: "control",
            data: { hex },
          });
        }
      },
    };
  },
});
