import { defineRule } from "@oxlint/plugins";

import {
  propertyName,
  staticPropertyName,
  unwrapExpression,
  testRegistration,
  isTestRunner,
  isImportedTest,
  isImportedTestDescribeConfigure,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const optionKeys = new Set(["timeout"]);

const configKeys = new Set(["testTimeout", "hookTimeout"]);

function hasOverrideKey(node: ESTree.Argument | undefined, keys: ReadonlySet<string>) {
  const options = node === undefined ? undefined : unwrapExpression(node);

  return (
    options?.type === "ObjectExpression" &&
    options.properties.some((property) => {
      const name = property.type === "Property" ? staticPropertyName(property) : null;

      return name !== null && keys.has(name);
    })
  );
}

function registrationOverride(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const registration = testRegistration(sourceCode, node);

  return (
    registration !== null &&
    (registration.timeout !== undefined ||
      registration.options.some((argument) => hasOverrideKey(argument, optionKeys)))
  );
}

function runnerOverride(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const callee = node.callee;

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const method = propertyName(callee);

  if (method === "setConfig") {
    return (
      isTestRunner(sourceCode, callee.object, "vi", ["vitest", "@effect/vitest"]) &&
      hasOverrideKey(node.arguments[0], configKeys)
    );
  }

  if (method === "setTimeout") {
    return (
      isTestRunner(sourceCode, callee.object, "jest", ["@jest/globals"]) ||
      isImportedTest(sourceCode, callee.object)
    );
  }

  if (method === "slow") {
    return isImportedTest(sourceCode, callee.object);
  }

  return (
    isImportedTestDescribeConfigure(sourceCode, callee) &&
    hasOverrideKey(node.arguments[0], optionKeys)
  );
}

export const noTestTimeoutOverrides = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Make slow tests faster instead of raising their timeout.",
    },
    schema: [],
    messages: {
      override:
        "This test raises its timeout to tolerate slow work. Make the test faster or wait for the specific event it needs instead.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        if (registrationOverride(sourceCode, node) || runnerOverride(sourceCode, node)) {
          context.report({ node, messageId: "override" });
        }
      },
    };
  },
});
