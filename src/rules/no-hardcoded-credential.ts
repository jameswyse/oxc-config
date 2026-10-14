import { defineRule } from "@oxlint/plugins";

import type { ESTree } from "@oxlint/plugins";

const credentials: readonly (readonly [string, RegExp])[] = [
  [
    "private key",
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?(?:-----END|$)/u,
  ],
  ["AWS access key", /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/u],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/u],
  ["Stripe live key", /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/u],
  ["Slack token", /\bxox[abposr]-[0-9A-Za-z-]{10,}\b/u],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/u],
  ["Anthropic or OpenAI key", /\bsk-(?:ant-[a-z0-9]+-|proj-)[A-Za-z0-9_-]{32,}/u],
];

const placeholder = /example|fake|dummy|placeholder|redacted|x{6,}|abcdefgh|12345678/iu;

function credentialIn(text: string): string | null {
  return (
    credentials.find(([, pattern]) => {
      const match = pattern.exec(text);

      return match !== null && !placeholder.test(match[0]);
    })?.[0] ?? null
  );
}

export const noHardcodedCredential = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow credentials written into source code." },
    schema: [],
    messages: {
      credential:
        "This looks like a real {{kind}}. Revoke it, then load the credential from the environment or a secret store.",
    },
  },
  create(context) {
    function check(node: ESTree.Node, text: string): void {
      const kind = credentialIn(text);

      if (kind !== null) {
        context.report({ node, messageId: "credential", data: { kind } });
      }
    }

    return {
      Literal(node) {
        if (typeof node.value === "string") {
          check(node, node.value);
        }
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
    };
  },
});
