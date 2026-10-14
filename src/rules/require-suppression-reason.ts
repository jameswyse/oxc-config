import { defineRule } from "@oxlint/plugins";

const disableDirective = /^\s*(?:oxlint|eslint)-disable(?:-next-line|-line)?(?=\s|$)(?<rest>.*)$/su;

export const requireSuppressionReason = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Require each lint suppression to name its rules and give a reason." },
    schema: [],
    messages: {
      rule: "Name the rules this directive suppresses, so it can't hide other diagnostics.",
      reason:
        "Give this suppression a reason after `--` that says why the reported code is correct here.",
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const rest = disableDirective.exec(comment.value)?.groups?.["rest"];

          if (rest === undefined) {
            continue;
          }

          const [rules = "", reason = ""] = rest.split(/\s-{2,}(?:\s|$)/u, 2);

          if (rules.trim() === "") {
            context.report({ loc: comment.loc, messageId: "rule" });
          } else if (reason.trim() === "") {
            context.report({ loc: comment.loc, messageId: "reason" });
          }
        }
      },
    };
  },
});
