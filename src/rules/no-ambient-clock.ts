import { defineRule } from "@oxlint/plugins";

import {
  importedBinding,
  isGlobalValue,
  isInjectionSeam,
  outermostExpression,
  staticPropertyName,
  unwrapExpression,
} from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const timeZoneModules = new Set(["@date-fns/tz", "@date-fns/tz/date", "@date-fns/tz/date/mini"]);

const timeZoneDates = new Set(["TZDate", "TZDateMini"]);

const clockHelpers = new Set([
  "date-fns/constructNow",
  "date-fns/startOfToday",
  "date-fns/endOfToday",
  "date-fns/startOfTomorrow",
  "date-fns/endOfTomorrow",
  "date-fns/startOfYesterday",
  "date-fns/endOfYesterday",
  "date-fns/isToday",
  "date-fns/isTomorrow",
  "date-fns/isYesterday",
  "date-fns/isPast",
  "date-fns/isFuture",
  "date-fns/isThisSecond",
  "date-fns/isThisMinute",
  "date-fns/isThisHour",
  "date-fns/isThisWeek",
  "date-fns/isThisISOWeek",
  "date-fns/isThisMonth",
  "date-fns/isThisQuarter",
  "date-fns/isThisYear",
  "date-fns/formatDistanceToNow",
  "date-fns/formatDistanceToNowStrict",
  "date-fns/isMatch",
]);

const curriedClockHelpers = new Map([
  ["date-fns/fp/isMatch", 2],
  ["date-fns/fp/isMatchWithOptions", 3],
]);

function exportPath(sourceCode: SourceCode, node: ESTree.Node): string | null {
  const binding = importedBinding(sourceCode, node);

  if (binding === null) {
    return null;
  }

  return binding.name === "default" || binding.source.endsWith(`/${binding.name}`)
    ? binding.source
    : `${binding.source}/${binding.name}`;
}

function fullApplication(call: ESTree.CallExpression, arity: number): ESTree.CallExpression | null {
  if (call.arguments.some((argument) => argument.type === "SpreadElement")) {
    return null;
  }

  const remaining = arity - call.arguments.length;

  if (remaining <= 0) {
    return call;
  }

  const parent = outermostExpression(call).parent;

  return parent?.type === "CallExpression" && unwrapExpression(parent.callee) === call
    ? fullApplication(parent, remaining)
    : null;
}

function isTimeZoneDate(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const binding = importedBinding(sourceCode, node);

  return binding !== null && timeZoneModules.has(binding.source) && timeZoneDates.has(binding.name);
}

function isCurrentTimeZoneDate(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
  const callee = unwrapExpression(node.callee);
  const [zone] = node.arguments;

  return (
    callee.type === "MemberExpression" &&
    staticPropertyName(callee) === "tz" &&
    isTimeZoneDate(sourceCode, callee.object) &&
    node.arguments.length === 1 &&
    zone?.type !== "SpreadElement"
  );
}

export const noAmbientClock = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Read the current date and time only in a clock owner." },
    schema: [],
    messages: {
      clock:
        "Accept the current time from the caller or an injected clock. If this module owns the clock, add it to the `clock` owners.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    function report(node: ESTree.Node): void {
      if (!isInjectionSeam(node)) {
        context.report({ node, messageId: "clock" });
      }
    }

    return {
      MemberExpression(node) {
        if (staticPropertyName(node) === "now" && isGlobalValue(sourceCode, node.object, "Date")) {
          report(node);
        }
      },
      NewExpression(node) {
        if (
          node.arguments.length === 0 &&
          (isGlobalValue(sourceCode, node.callee, "Date") ||
            isTimeZoneDate(sourceCode, node.callee))
        ) {
          report(node);
        }
      },
      CallExpression(node) {
        const helper = exportPath(sourceCode, node.callee);
        const arity = helper === null ? undefined : curriedClockHelpers.get(helper);
        const applied = arity === undefined ? null : fullApplication(node, arity);

        if (applied !== null) {
          report(applied);
        }

        if (
          isGlobalValue(sourceCode, node.callee, "Date") ||
          (helper !== null && clockHelpers.has(helper)) ||
          isCurrentTimeZoneDate(sourceCode, node)
        ) {
          report(node);
        }
      },
    };
  },
});
