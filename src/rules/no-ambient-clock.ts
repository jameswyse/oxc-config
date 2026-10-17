import { defineRule } from "@oxlint/plugins";

import {
  importedBinding,
  isGlobalValue,
  isInjectedValue,
  isInjectionSeam,
  moduleExportName,
  outermostExpression,
  staticPropertyName,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

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
  "date-fns/fp/isMatch",
  "date-fns/fp/isMatchWithOptions",
]);

function helperPath(source: string, name: string): string {
  return name === "default" || source.endsWith(`/${name}`) ? source : `${source}/${name}`;
}

function isClockHelper(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const binding = importedBinding(sourceCode, node);

  return binding !== null && clockHelpers.has(helperPath(binding.source, binding.name));
}

function exposesClockHelper(source: string): boolean {
  return [...clockHelpers].some(
    (helper) => helperPath(source, helper.slice(helper.lastIndexOf("/") + 1)) === helper,
  );
}

function isTypeImport(definition: Variable["defs"][number]): boolean {
  const declaration = definition.parent;
  const specifier = definition.node;

  return (
    declaration?.type === "ImportDeclaration" &&
    (declaration.importKind === "type" ||
      (specifier.type === "ImportSpecifier" && specifier.importKind === "type"))
  );
}

function isTypePosition(node: ESTree.Node): boolean {
  const parent = node.parent;
  const declaration = parent?.parent;

  return (
    parent?.type === "TSTypeQuery" ||
    parent?.type === "TSQualifiedName" ||
    (parent?.type === "ExportSpecifier" &&
      (parent.exportKind === "type" ||
        (declaration?.type === "ExportNamedDeclaration" && declaration.exportKind === "type")))
  );
}

function isValueReference(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const variable = variableFor(sourceCode, node);
  const definition = variable?.defs[0];

  return (
    variable !== null &&
    definition !== undefined &&
    !isTypeImport(definition) &&
    !isTypePosition(node) &&
    variable.references.some((reference) => reference.identifier === node && reference.isRead())
  );
}

const functionMethods = new Set(["call", "apply", "bind"]);

function helperUse(node: ESTree.Node): ESTree.Node {
  const value = outermostExpression(node);
  const parent = value.parent;

  if (parent?.type === "CallExpression" && parent.callee === value) {
    return helperUse(parent);
  }

  if (
    parent?.type === "MemberExpression" &&
    parent.object === value &&
    functionMethods.has(staticPropertyName(parent) ?? "")
  ) {
    const use = helperUse(parent);

    return use === parent ? node : use;
  }

  return node;
}

function isAssigned(node: ESTree.Node): boolean {
  const target = outermostExpression(node);
  const parent = target.parent;

  return (
    parent?.type === "AssignmentExpression" && parent.left === target && parent.operator === "="
  );
}

function isFollowedAlias(node: ESTree.Node): boolean {
  const value = outermostExpression(node);
  const declarator = value.parent;
  const declaration = declarator?.parent;

  return (
    declarator?.type === "VariableDeclarator" &&
    declarator.init === value &&
    declarator.id.type === "Identifier" &&
    declaration?.type === "VariableDeclaration" &&
    declaration.kind === "const" &&
    declaration.parent.type !== "ExportNamedDeclaration"
  );
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

    function reportHelper(reference: ESTree.Node): void {
      const use = helperUse(reference);

      if ((use !== reference || !isFollowedAlias(reference)) && !isInjectedValue(use)) {
        context.report({ node: use, messageId: "clock" });
      }
    }

    return {
      Identifier(node) {
        if (isClockHelper(sourceCode, node) && isValueReference(sourceCode, node)) {
          reportHelper(node);
        }
      },
      MemberExpression(node) {
        if (staticPropertyName(node) === "now" && isGlobalValue(sourceCode, node.object, "Date")) {
          report(node);
        }

        if (isClockHelper(sourceCode, node) && !isAssigned(node)) {
          reportHelper(node);
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
        if (
          isGlobalValue(sourceCode, node.callee, "Date") ||
          isCurrentTimeZoneDate(sourceCode, node)
        ) {
          report(node);
        }
      },
      ExportNamedDeclaration(node) {
        if (!node.source || node.exportKind === "type") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (
            specifier.exportKind !== "type" &&
            clockHelpers.has(helperPath(node.source.value, moduleExportName(specifier.local)))
          ) {
            context.report({ node: specifier, messageId: "clock" });
          }
        }
      },
      ExportAllDeclaration(node) {
        if (node.exportKind !== "type" && exposesClockHelper(node.source.value)) {
          context.report({ node, messageId: "clock" });
        }
      },
    };
  },
});
