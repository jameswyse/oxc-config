import { defineRule } from "@oxlint/plugins";

import { importedBinding, isGlobalValue, isInjectionSeam, propertyName } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

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
  "date-fns/fp/isMatch",
  "date-fns/fp/isMatchWithOptions",
]);

function exportPath(sourceCode: SourceCode, node: ESTree.Node): string | null {
  const binding = importedBinding(sourceCode, node);

  if (binding === null) {
    return null;
  }

  const module = binding.source.replace(/\.c?js$/, "");

  return binding.name === "default" || module.endsWith(`/${binding.name}`)
    ? module
    : `${module}/${binding.name}`;
}

function isTimeZoneDate(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const binding = importedBinding(sourceCode, node);

  return binding?.source === "@date-fns/tz" && timeZoneDates.has(binding.name);
}

function isCurrentTimeZoneDate(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
  const [zone] = node.arguments;

  return (
    node.callee.type === "MemberExpression" &&
    propertyName(node.callee) === "tz" &&
    isTimeZoneDate(sourceCode, node.callee.object) &&
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
        if (propertyName(node) === "now" && isGlobalValue(sourceCode, node.object, "Date")) {
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
