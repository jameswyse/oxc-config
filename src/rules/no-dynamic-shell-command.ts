import { defineRule } from "@oxlint/plugins";

import {
  constantString,
  dynamicParts,
  importedBinding,
  staticPropertyName,
  unchangedInit,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

const childProcessModules = new Set(["child_process", "node:child_process"]);

const utilModules = new Set(["util", "node:util"]);

const shellCommands = new Set(["exec", "execSync"]);

const shellOptionCommands = new Set(["spawn", "spawnSync", "execFile", "execFileSync"]);

type ShellOption = { readonly node: ESTree.Node; readonly index: number };

function childProcessFunction(sourceCode: SourceCode, node: ESTree.Node): string | null {
  const binding = importedBinding(sourceCode, node);

  return binding !== null && childProcessModules.has(binding.source) ? binding.name : null;
}

function initialValue(sourceCode: SourceCode, node: ESTree.Node): ESTree.Node {
  const seen = new Set<Variable>();
  let value = unwrapExpression(node);

  for (
    let variable = variableFor(sourceCode, value);
    variable !== null && !seen.has(variable);
    variable = variableFor(sourceCode, value)
  ) {
    const init = unchangedInit(variable);

    if (init === null) {
      break;
    }

    seen.add(variable);
    value = unwrapExpression(init);
  }

  return value;
}

function promisifiedFunction(sourceCode: SourceCode, node: ESTree.Node): string | null {
  const call = initialValue(sourceCode, node);
  const binding = call.type === "CallExpression" ? importedBinding(sourceCode, call.callee) : null;
  const original = call.type === "CallExpression" ? call.arguments[0] : undefined;

  return binding !== null &&
    utilModules.has(binding.source) &&
    binding.name === "promisify" &&
    original !== undefined
    ? childProcessFunction(sourceCode, original)
    : null;
}

function isDynamic(sourceCode: SourceCode, node: ESTree.Node): boolean {
  return node.type === "SpreadElement" || dynamicParts(sourceCode, node).length > 0;
}

function staticArray(sourceCode: SourceCode, node: ESTree.Node): ESTree.ArrayExpression | null {
  const value = unwrapExpression(node);

  if (value.type === "ArrayExpression") {
    return value;
  }

  const variable = variableFor(sourceCode, value);
  const init = variable === null ? null : unchangedInit(variable);
  const array = init === null ? null : unwrapExpression(init);

  const onlyPassedToCalls = variable?.references.every(
    ({ identifier, init: isInit }) =>
      isInit ||
      (identifier.parent.type === "CallExpression" &&
        identifier.parent.arguments.some((argument) => argument === identifier)),
  );

  return array?.type === "ArrayExpression" && onlyPassedToCalls === true ? array : null;
}

function hasDynamicArguments(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const array = staticArray(sourceCode, node);

  return array === null
    ? true
    : array.elements.some((element) => element !== null && isDynamic(sourceCode, element));
}

function enablesShell(
  sourceCode: SourceCode,
  property: ESTree.ObjectExpression["properties"][number],
): boolean {
  if (property.type !== "Property" || staticPropertyName(property) !== "shell") {
    return false;
  }

  const value = initialValue(sourceCode, property.value);

  if (value.type === "Literal" && typeof value.value === "boolean") {
    return value.value;
  }

  return Boolean(constantString(sourceCode, value));
}

function shellOption(sourceCode: SourceCode, call: ESTree.CallExpression): ShellOption | null {
  for (const [index, argument] of call.arguments.entries()) {
    const inline = unwrapExpression(argument);
    const options = initialValue(sourceCode, argument);

    const property =
      options.type === "ObjectExpression"
        ? options.properties.find((candidate) => enablesShell(sourceCode, candidate))
        : undefined;

    if (property !== undefined) {
      return { node: options === inline ? property : argument, index };
    }
  }

  return null;
}

export const noDynamicShellCommand = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow running commands built at run time through a shell." },
    schema: [],
    messages: {
      command:
        "`{{name}}` runs this command through a shell, so a value built into it can run other commands. Pass the program and its arguments separately to `execFile` or `spawn`.",
      shell:
        "The `shell` option makes `{{name}}` run its command through a shell, so a value built into the command or its arguments can run other commands. Remove the option and pass the arguments as an array.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      CallExpression(node) {
        const name =
          childProcessFunction(sourceCode, node.callee) ??
          promisifiedFunction(sourceCode, node.callee);

        const [command] = node.arguments;

        if (name === null || command === undefined) {
          return;
        }

        if (shellCommands.has(name) && isDynamic(sourceCode, command)) {
          context.report({ node: command, messageId: "command", data: { name } });

          return;
        }

        const shell = shellOptionCommands.has(name) ? shellOption(sourceCode, node) : null;

        if (
          shell !== null &&
          (isDynamic(sourceCode, command) ||
            node.arguments
              .slice(1, shell.index)
              .some((argument) => hasDynamicArguments(sourceCode, argument)))
        ) {
          context.report({ node: shell.node, messageId: "shell", data: { name } });
        }
      },
    };
  },
});
