import { defineRule } from "@oxlint/plugins";

import {
  propertyName,
  unwrapExpression,
  testRegistration,
  isTestRunner,
  isImportedTestDescribeConfigure,
  vitestModules,
} from "../shared/index.ts";
import {
  configExportVisitors,
  configFileRunner,
  finalValue,
  playwrightProjects,
  vitestProjects,
  vitestRootTestValue,
} from "../shared/test-runner-config.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

import type { ConfigLayers, ConfigMerge, ConfigRunner } from "../shared/test-runner-config.ts";

type ConfigRetries = (
  sourceCode: SourceCode,
  layers: ConfigLayers,
  inspected: Set<ESTree.Node>,
) => ESTree.Node[];

const registrationKeys = ["retry", "retries"];

function isZero(node: ESTree.Node) {
  const value = unwrapExpression(node);

  return value.type === "Literal" && value.value === 0;
}

function nonZero(value: ESTree.Node | null) {
  return value === null || isZero(value) ? null : value;
}

function retryValue(
  sourceCode: SourceCode,
  layers: ConfigLayers,
  name: string,
  merge: ConfigMerge,
) {
  return nonZero(finalValue(sourceCode, layers, name, merge));
}

function hasRetry(sourceCode: SourceCode, node: ESTree.Node | undefined, names: readonly string[]) {
  return (
    node !== undefined &&
    names.some((name) => retryValue(sourceCode, [node], name, "spread") !== null)
  );
}

function testRetry(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const registration = testRegistration(sourceCode, node);

  if (registration !== null) {
    return registration.options.some((argument) =>
      hasRetry(sourceCode, argument, registrationKeys),
    );
  }

  const callee = node.callee;

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const method = propertyName(callee);
  const [first] = node.arguments;

  if (method === "setConfig") {
    return (
      isTestRunner(sourceCode, callee.object, "vi", vitestModules) &&
      hasRetry(sourceCode, first, ["retry"])
    );
  }

  if (method === "retryTimes") {
    return (
      isTestRunner(sourceCode, callee.object, "jest", ["@jest/globals"]) &&
      !(first !== undefined && isZero(first))
    );
  }

  return (
    isImportedTestDescribeConfigure(sourceCode, callee) && hasRetry(sourceCode, first, ["retries"])
  );
}

const vitestRetries: ConfigRetries = (sourceCode, layers, inspected) => {
  const retry = nonZero(vitestRootTestValue(sourceCode, layers, "retry"));

  return [
    ...(retry === null ? [] : [retry]),
    ...vitestProjects(sourceCode, layers, inspected).flatMap((project) =>
      vitestRetries(sourceCode, project, inspected),
    ),
  ];
};

const playwrightRetries: ConfigRetries = (sourceCode, layers) =>
  [layers, ...playwrightProjects(sourceCode, layers)].flatMap(
    (alternative) => retryValue(sourceCode, alternative, "retries", "spread") ?? [],
  );

const configRetries: Record<ConfigRunner, ConfigRetries> = {
  vitest: vitestRetries,
  playwright: playwrightRetries,
};

export const noTestRetries = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Fix flaky tests instead of retrying them." },
    schema: [],
    messages: {
      retry:
        "A test that passes on rerun is a flaky test. Fix the cause instead of retrying it, for example by awaiting the event the test depends on.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const runner = configFileRunner(context.filename);
    const reported = new Set<ESTree.Node>();

    const inspected = new Set<ESTree.Node>();

    const report = (node: ESTree.Node) => {
      if (!reported.has(node)) {
        reported.add(node);
        context.report({ node, messageId: "retry" });
      }
    };

    const configChecks =
      runner === null
        ? {}
        : configExportVisitors(sourceCode, (layers) => {
            configRetries[runner](sourceCode, layers, inspected).forEach(report);
          });

    return {
      ...configChecks,
      CallExpression(node) {
        if (testRetry(sourceCode, node)) {
          report(node);
        }
      },
    };
  },
});
