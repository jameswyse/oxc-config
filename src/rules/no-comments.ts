import { defineRule } from "@oxlint/plugins";

import { optionStrings } from "../shared/rule-options.ts";

import type { Comment } from "@oxlint/plugins";

const directivePatterns = [
  /^(?:oxlint|eslint)-(?:disable|enable)(?:-next-line|-line)?(?:\s|$)/u,
  /^@ts-(?:expect-error|ignore|nocheck|check)(?:\s|$)/u,
  /^\/\s*<(?:reference|amd-module|amd-dependency)\s/u,
  /^[#@]__(?:PURE|NO_SIDE_EFFECTS)__$/u,
  /^(?:oxfmt|prettier|biome)-ignore(?:-start|-end|-all)?(?:\s|$)/u,
  /^(?:c8|v8|istanbul)\s+ignore(?:\s|$)/u,
  /^@vite-ignore$/u,
  /^webpack[A-Z]\w*:/u,
  /^@(?:vitest|jest)-environment\s/u,
  /^@jsx(?:ImportSource|Runtime|Frag)?\s/u,
];

function commentText(comment: Comment): string {
  return comment.value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?/u, "").trim())
    .filter((line) => line.length > 0)
    .join(" ");
}

const javaScriptFile = /\.(?:js|jsx|mjs|cjs)$/u;

const typeTag =
  /@(?:(?:type|typedef|callback|template|satisfies|import|overload|this|enum|extends|augments|implements)\b|(?:param|arg|argument|returns?|property|prop)\s+\{)/u;

function isTypeAnnotation(comment: Comment): boolean {
  return comment.type === "Block" && comment.value.startsWith("*") && typeTag.test(comment.value);
}

export const noComments = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Express intent in code instead of comments; allow tool directives and JavaScript type annotations.",
    },
    schema: [
      {
        type: "object",
        properties: { allow: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      comment:
        "Remove this comment. Carry intent in a name, type, test or validating function, and put a reason the code cannot show in the commit message.",
    },
  },
  create(context) {
    const allowed = [
      ...directivePatterns,
      ...optionStrings(context.options, "allow").map((source) => new RegExp(source, "u")),
    ];

    const typedDocs = javaScriptFile.test(context.filename);

    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (comment.type === "Shebang" || (typedDocs && isTypeAnnotation(comment))) {
            continue;
          }

          const text = commentText(comment);

          if (!allowed.some((pattern) => pattern.test(text))) {
            context.report({ loc: comment.loc, messageId: "comment" });
          }
        }
      },
    };
  },
});
