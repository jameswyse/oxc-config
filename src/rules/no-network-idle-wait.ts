import { defineRule } from "@oxlint/plugins";

import { staticPropertyName, staticString, unwrapExpression } from "../shared/index.ts";
import { resolveProperty, valueBranches } from "../shared/object-properties.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const networkIdleStates = new Set(["networkidle", "networkidle0", "networkidle2"]);

const playwrightNetworkIdle = new Set(["networkidle"]);

const waitUntilOptionsIndex = new Map([
  ["goto", 1],
  ["reload", 0],
  ["goBack", 0],
  ["goForward", 0],
  ["waitForNavigation", 0],
  ["waitForURL", 1],
  ["setContent", 1],
]);

function resolvesTo(sourceCode: SourceCode, node: ESTree.Node, states: ReadonlySet<string>) {
  return valueBranches(sourceCode, node).some((value) => states.has(staticString(value) ?? ""));
}

function waitsForNetworkIdle(sourceCode: SourceCode, waitUntil: ESTree.Node) {
  return valueBranches(sourceCode, waitUntil).some((value) =>
    value.type === "ArrayExpression"
      ? value.elements.some(
          (element) => element !== null && resolvesTo(sourceCode, element, networkIdleStates),
        )
      : resolvesTo(sourceCode, value, networkIdleStates),
  );
}

function waitUntilOptions(node: ESTree.CallExpression) {
  const callee = unwrapExpression(node.callee);

  if (callee.type !== "MemberExpression") {
    return undefined;
  }

  const index = waitUntilOptionsIndex.get(staticPropertyName(callee) ?? "");

  return index === undefined ? undefined : node.arguments[index];
}

function networkIdleOption(sourceCode: SourceCode, options: ESTree.Argument) {
  const waitUntil = resolveProperty(sourceCode, options, "waitUntil");

  if (waitUntil.kind !== "known" || !waitsForNetworkIdle(sourceCode, waitUntil.value)) {
    return null;
  }

  return waitUntil.value.parent?.type === "Property" ? waitUntil.value.parent : options;
}

function networkIdleLoadState(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const [state] = node.arguments;

  return node.callee.type === "MemberExpression" &&
    staticPropertyName(node.callee) === "waitForLoadState" &&
    state !== undefined &&
    resolvesTo(sourceCode, state, playwrightNetworkIdle)
    ? state
    : null;
}

export const noNetworkIdleWait = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Wait for the state a browser test needs instead of network idleness." },
    schema: [],
    messages: {
      networkIdle:
        '`networkidle` waits for the network to stay quiet for 500 ms, so its timing depends on the machine and background requests. Wait for the element or state the test needs with a web-first assertion, such as `await expect(page.getByRole("button", { name: "Save" })).toBeVisible()`.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const reported = new Set<ESTree.Node>();

    function report(node: ESTree.Node) {
      if (!reported.has(node)) {
        reported.add(node);
        context.report({ node, messageId: "networkIdle" });
      }
    }

    return {
      CallExpression(node) {
        const loadState = networkIdleLoadState(sourceCode, node);

        if (loadState !== null) {
          report(loadState);
        }

        const options = waitUntilOptions(node);
        const option = options === undefined ? null : networkIdleOption(sourceCode, options);

        if (option !== null) {
          report(option);
        }
      },
    };
  },
});
