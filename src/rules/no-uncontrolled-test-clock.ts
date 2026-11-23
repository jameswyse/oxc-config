import { defineRule } from "@oxlint/plugins";

import {
  importedBinding,
  isGlobalValue,
  isPlaywright,
  staticPropertyName,
  testContext,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";
import { resolveProperty } from "../shared/object-properties.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type TimerApi = "Date" | "performance";

type Clock = TimerApi | "perf_hooks";

const timerLists = ["apis", "toFake", "doNotFake", "toNotFake"];

const timerExclusionLists = new Set(["doNotFake", "toNotFake"]);

const perfHooksModules = new Set(["node:perf_hooks", "perf_hooks"]);

const sinonFakeTimersModule = "@sinonjs/fake-timers";

function nameOf(node: ESTree.Node) {
  const value = unwrapExpression(node);

  return value.type === "Identifier" ? value.name : staticPropertyName(value);
}

function fakes(sourceCode: SourceCode, options: ESTree.Node | undefined, api: TimerApi) {
  if (options === undefined) {
    return true;
  }

  return timerLists.every((name) => {
    const resolved = resolveProperty(sourceCode, options, name);
    const list = resolved.kind === "known" ? unwrapExpression(resolved.value) : null;

    if (list?.type !== "ArrayExpression") {
      return true;
    }

    const values = list.elements.map((element) =>
      element?.type === "Literal" ? element.value : undefined,
    );

    if (values.length === 0 || values.includes(undefined)) {
      return true;
    }

    return timerExclusionLists.has(name) ? !values.includes(api) : values.includes(api);
  });
}

function fakedClocks(
  sourceCode: SourceCode,
  options: ESTree.Node | undefined,
  performanceClocks: readonly Clock[],
) {
  return [
    ...(fakes(sourceCode, options, "Date") ? (["Date"] as const) : []),
    ...(fakes(sourceCode, options, "performance") ? performanceClocks : []),
  ];
}

function isNodeMock(sourceCode: SourceCode, node: ESTree.Node) {
  const binding = importedBinding(sourceCode, node);

  return nameOf(node) === "mock" || (binding?.source === "node:test" && binding.name === "mock");
}

function isSinonInstall(sourceCode: SourceCode, callee: ESTree.Node) {
  const binding = importedBinding(sourceCode, callee);

  return binding?.source === sinonFakeTimersModule && binding.name === "install";
}

function isLocalFunction(sourceCode: SourceCode, node: ESTree.Node) {
  const definition = variableFor(sourceCode, node)?.defs[0];

  return definition !== undefined && definition.type !== "ImportBinding";
}

function controlledClocks(sourceCode: SourceCode, call: ESTree.CallExpression): readonly Clock[] {
  const callee = unwrapExpression(call.callee);
  const name = isLocalFunction(sourceCode, callee) ? null : nameOf(callee);

  if (name === "setSystemTime") {
    return ["Date"];
  }

  if (name === "useFakeTimers") {
    return fakedClocks(sourceCode, call.arguments[0], ["performance"]);
  }

  if (isSinonInstall(sourceCode, callee)) {
    return fakedClocks(sourceCode, call.arguments[0], ["performance", "perf_hooks"]);
  }

  if (name === null || callee.type !== "MemberExpression") {
    return [];
  }

  const owner = unwrapExpression(callee.object);

  if (nameOf(owner) === "clock" && name === "install") {
    return ["Date", "performance"];
  }

  if (nameOf(owner) === "clock" && name === "setFixedTime") {
    return ["Date"];
  }

  return name === "enable" &&
    owner.type === "MemberExpression" &&
    nameOf(owner) === "timers" &&
    isNodeMock(sourceCode, owner.object) &&
    fakes(sourceCode, call.arguments[0], "Date")
    ? ["Date"]
    : [];
}

function isPerfHooksPerformance(sourceCode: SourceCode, node: ESTree.Node) {
  const binding = importedBinding(sourceCode, node);

  return binding !== null && perfHooksModules.has(binding.source) && binding.name === "performance";
}

function clockRead(sourceCode: SourceCode, call: ESTree.CallExpression): Clock | null {
  const callee = unwrapExpression(call.callee);

  if (callee.type !== "MemberExpression" || staticPropertyName(callee) !== "now") {
    return null;
  }

  if (isGlobalValue(sourceCode, callee.object, "Date")) {
    return "Date";
  }

  if (isGlobalValue(sourceCode, callee.object, "performance")) {
    return "performance";
  }

  return isPerfHooksPerformance(sourceCode, callee.object) ? "perf_hooks" : null;
}

export const noUncontrolledTestClock = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require tests that read the current time to control the clock." },
    schema: [],
    messages: {
      clock:
        "This test reads the real clock, so its result depends on when it runs. Use a fixed date, or control time with fake timers.",
      performance:
        "This test reads the real `performance.now()`, so its result depends on how fast the machine runs it. Control time with fake timers that replace the global `performance`, or don't assert on elapsed time.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    const drivesBrowser = sourceCode.ast.body.some(
      (statement) => statement.type === "ImportDeclaration" && isPlaywright(statement.source.value),
    );

    if (drivesBrowser) {
      return {};
    }

    const reads: { readonly node: ESTree.Node; readonly clock: Clock }[] = [];
    const controlledTests = new Map<ESTree.Node, Set<Clock>>();
    const controlledFile = new Set<Clock>();

    function enclosingTest(node: ESTree.Node) {
      const test = testContext(sourceCode, node);

      return test?.api.name === "test" || test?.api.name === "it" ? test.callback : null;
    }

    function controlledAt(test: ESTree.Node | null) {
      if (test === null) {
        return controlledFile;
      }

      const controlled = controlledTests.get(test) ?? new Set<Clock>();

      controlledTests.set(test, controlled);

      return controlled;
    }

    return {
      CallExpression(node) {
        const clocks = controlledClocks(sourceCode, node);

        if (clocks.length > 0) {
          const controlled = controlledAt(enclosingTest(node));

          for (const clock of clocks) {
            controlled.add(clock);
          }
        }

        const clock = clockRead(sourceCode, node);

        if (clock !== null) {
          reads.push({ node, clock });
        }
      },
      NewExpression(node) {
        if (node.arguments.length === 0 && isGlobalValue(sourceCode, node.callee, "Date")) {
          reads.push({ node, clock: "Date" });
        }
      },
      "Program:exit"() {
        for (const { node, clock } of reads) {
          const test = enclosingTest(node);

          if (
            controlledFile.has(clock) ||
            (test !== null && controlledTests.get(test)?.has(clock))
          ) {
            continue;
          }

          context.report({ node, messageId: clock === "Date" ? "clock" : "performance" });
        }
      },
    };
  },
});
