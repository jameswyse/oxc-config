import { defineRule } from "@oxlint/plugins";

import {
  importedBinding,
  isGlobalValue,
  isPlaywright,
  propertyName,
  staticPropertyName,
  unwrapExpression,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const fakeClockMethods = new Set(["install", "setFixedTime"]);

const timerLists = new Set(["apis", "toFake", "doNotFake"]);

function nameOf(node: ESTree.Node): string | null {
  const value = unwrapExpression(node);

  return value.type === "Identifier" ? value.name : staticPropertyName(value);
}

function fakesDate(options: ESTree.Node | undefined): boolean {
  const value = options === undefined ? undefined : unwrapExpression(options);

  if (value?.type !== "ObjectExpression") {
    return true;
  }

  return value.properties.every((property) => {
    const name = property.type === "Property" ? staticPropertyName(property) : null;
    const list = property.type === "Property" ? unwrapExpression(property.value) : null;

    if (name === null || !timerLists.has(name) || list?.type !== "ArrayExpression") {
      return true;
    }

    const values = list.elements.map((element) =>
      element?.type === "Literal" ? element.value : undefined,
    );

    if (values.length === 0 || values.includes(undefined)) {
      return true;
    }

    return name === "doNotFake" ? !values.includes("Date") : values.includes("Date");
  });
}

function isNodeMock(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const binding = importedBinding(sourceCode, unwrapExpression(node));

  return nameOf(node) === "mock" || (binding?.source === "node:test" && binding.name === "mock");
}

function controlsClock(sourceCode: SourceCode, call: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(call.callee);
  const name = nameOf(callee);

  if (name === "setSystemTime") {
    return true;
  }

  if (name === "useFakeTimers") {
    return fakesDate(call.arguments[0]);
  }

  if (name === null || callee.type !== "MemberExpression") {
    return false;
  }

  const owner = unwrapExpression(callee.object);

  return (
    (nameOf(owner) === "clock" && fakeClockMethods.has(name)) ||
    (name === "enable" &&
      owner.type === "MemberExpression" &&
      nameOf(owner) === "timers" &&
      isNodeMock(sourceCode, owner.object) &&
      fakesDate(call.arguments[0]))
  );
}

export const noUncontrolledTestClock = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require tests that read the current time to control the clock." },
    schema: [],
    messages: {
      clock:
        "This test reads the real clock, so its result depends on when it runs. Use a fixed date, or control time with fake timers.",
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

    const reads: ESTree.Node[] = [];
    let controlled = false;

    return {
      CallExpression(node) {
        controlled ||= controlsClock(sourceCode, node);

        if (
          node.callee.type === "MemberExpression" &&
          propertyName(node.callee) === "now" &&
          isGlobalValue(sourceCode, node.callee.object, "Date")
        ) {
          reads.push(node);
        }
      },
      NewExpression(node) {
        if (node.arguments.length === 0 && isGlobalValue(sourceCode, node.callee, "Date")) {
          reads.push(node);
        }
      },
      "Program:exit"() {
        if (!controlled) {
          for (const node of reads) {
            context.report({ node, messageId: "clock" });
          }
        }
      },
    };
  },
});
