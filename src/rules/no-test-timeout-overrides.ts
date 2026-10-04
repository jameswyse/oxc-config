import { defineRule } from "@oxlint/plugins";

import { isGlobal, propertyName, apiReference, testModules } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const optionKeys = new Set(["timeout", "retry", "retries"]);

const configKeys = new Set(["testTimeout", "hookTimeout", "retry"]);

const hooks = new Set(["beforeEach", "afterEach", "beforeAll", "afterAll"]);

const functionTypes = new Set(["ArrowFunctionExpression", "FunctionExpression"]);

function testApi(sourceCode: SourceCode, callee: ESTree.Expression): string | null {
  const api = apiReference(sourceCode, callee);

  if (api && (testModules.has(api.module) || api.module === "global")) {
    return api.name;
  }

  if (isGlobal(sourceCode, callee, "describe")) {
    return "describe";
  }

  const base = callee.type === "MemberExpression" ? callee.object : null;

  if (
    base &&
    propertyName(callee) === "describe" &&
    apiReference(sourceCode, base)?.name === "test"
  ) {
    return "describe";
  }

  return null;
}

function hasOverrideKey(node: ESTree.Argument | undefined, keys: ReadonlySet<string>): boolean {
  return (
    node?.type === "ObjectExpression" &&
    node.properties.some((property) => {
      const name = property.type === "Property" ? propertyName(property) : null;

      return name !== null && keys.has(name);
    })
  );
}

function timeoutArgument(node: ESTree.Argument | undefined): boolean {
  return (
    node !== undefined &&
    node.type !== "ObjectExpression" &&
    node.type !== "SpreadElement" &&
    !functionTypes.has(node.type)
  );
}

function registrationOverride(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
  const name = testApi(sourceCode, node.callee);

  if (!name) {
    return false;
  }

  if (hooks.has(name)) {
    return timeoutArgument(node.arguments[1]) || hasOverrideKey(node.arguments[1], optionKeys);
  }

  if (!["test", "it", "describe"].includes(name)) {
    return false;
  }

  return (
    node.arguments.some((argument) => hasOverrideKey(argument, optionKeys)) ||
    timeoutArgument(node.arguments[2])
  );
}

function runnerObject(
  sourceCode: SourceCode,
  node: ESTree.Expression,
  name: string,
  modules: readonly string[],
): boolean {
  if (isGlobal(sourceCode, node, name)) {
    return true;
  }

  const api = apiReference(sourceCode, node);

  return api?.name === name && modules.includes(api.module);
}

function importedTest(sourceCode: SourceCode, node: ESTree.Expression): boolean {
  const api = apiReference(sourceCode, node);

  return api?.name === "test" && api.module !== "global";
}

function runnerOverride(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
  const callee = node.callee;

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const method = propertyName(callee);

  if (method === "setConfig") {
    return (
      runnerObject(sourceCode, callee.object, "vi", ["vitest", "@effect/vitest"]) &&
      hasOverrideKey(node.arguments[0], configKeys)
    );
  }

  if (method === "setTimeout") {
    return (
      runnerObject(sourceCode, callee.object, "jest", ["@jest/globals"]) ||
      importedTest(sourceCode, callee.object)
    );
  }

  if (method === "slow") {
    return importedTest(sourceCode, callee.object);
  }

  return (
    method === "configure" &&
    callee.object.type === "MemberExpression" &&
    propertyName(callee.object) === "describe" &&
    importedTest(sourceCode, callee.object.object) &&
    hasOverrideKey(node.arguments[0], optionKeys)
  );
}

export const noTestTimeoutOverrides = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Make slow or flaky tests faster and deterministic instead of raising their timeout or retries.",
    },
    schema: [],
    messages: {
      override:
        "This test raises its timeout or retries to tolerate slow or flaky work. Make the test faster or deterministic instead.",
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
