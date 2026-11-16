import { defineRule } from "@oxlint/plugins";

import {
  constantString,
  dynamicParts,
  importedBinding,
  outermostExpression,
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

type ConstChain = { readonly value: ESTree.Node; readonly variables: readonly Variable[] };

function constChain(sourceCode: SourceCode, node: ESTree.Node): ConstChain {
  const variables: Variable[] = [];
  let value = unwrapExpression(node);

  for (
    let variable = variableFor(sourceCode, value);
    variable !== null && !variables.includes(variable);
    variable = variableFor(sourceCode, value)
  ) {
    const init = unchangedInit(variable);

    if (init === null) {
      break;
    }

    variables.push(variable);
    value = unwrapExpression(init);
  }

  return { value, variables };
}

function promisifiedFunction(sourceCode: SourceCode, node: ESTree.Node): string | null {
  const call = constChain(sourceCode, node).value;
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

function childProcessCallee(sourceCode: SourceCode, node: ESTree.Node): string | null {
  return childProcessFunction(sourceCode, node) ?? promisifiedFunction(sourceCode, node);
}

type ReferenceUse = "input" | "read" | "write" | "alias" | "escape";

const readingParents = new Set(["TSTypeQuery"]);

const patternParents = new Set(["ArrayPattern", "ObjectPattern", "RestElement"]);

function patternRoot(node: ESTree.Node): ESTree.Node {
  const parent = node.parent;

  const isPatternPart =
    parent !== null &&
    (patternParents.has(parent.type) ||
      (parent.type === "AssignmentPattern" && parent.left === node) ||
      (parent.type === "Property" &&
        parent.value === node &&
        parent.parent.type === "ObjectPattern"));

  return isPatternPart ? patternRoot(parent) : node;
}

function isAssignmentTarget(node: ESTree.Node): boolean {
  const target = patternRoot(node);
  const holder = target.parent;

  return (
    (holder?.type === "AssignmentExpression" && holder.left === target) ||
    ((holder?.type === "ForOfStatement" || holder?.type === "ForInStatement") &&
      holder.left === target)
  );
}

function memberUse(member: ESTree.Node): ReferenceUse {
  const outer = outermostExpression(member);
  const user = outer.parent;

  const isWrite =
    isAssignmentTarget(outer) ||
    user?.type === "UpdateExpression" ||
    (user?.type === "UnaryExpression" && user.operator === "delete") ||
    (user?.type === "CallExpression" && user.callee === outer) ||
    (user?.type === "TaggedTemplateExpression" && user.tag === outer);

  return isWrite ? "write" : "read";
}

function referenceUse(sourceCode: SourceCode, identifier: ESTree.Node): ReferenceUse {
  const reference = outermostExpression(identifier);
  const parent = reference.parent;

  if (parent?.type === "CallExpression" && parent.arguments.some((item) => item === reference)) {
    return childProcessCallee(sourceCode, parent.callee) === null ? "escape" : "input";
  }

  if (parent?.type === "MemberExpression" && parent.object === reference) {
    return memberUse(parent);
  }

  if (parent?.type === "VariableDeclarator" && parent.init === reference) {
    return parent.id.type === "Identifier" ? "alias" : "read";
  }

  return parent !== null && readingParents.has(parent.type) ? "read" : "escape";
}

function staticArray(sourceCode: SourceCode, node: ESTree.Node): ESTree.ArrayExpression | null {
  const value = unwrapExpression(node);

  if (value.type === "ArrayExpression") {
    return value;
  }

  const variable = variableFor(sourceCode, value);
  const init = variable === null ? null : unchangedInit(variable);
  const array = init === null ? null : unwrapExpression(init);

  const isExported = variable?.defs.some(
    (definition) => definition.parent?.parent?.type === "ExportNamedDeclaration",
  );

  return variable !== null &&
    array?.type === "ArrayExpression" &&
    isExported === false &&
    variable.references.every(
      ({ identifier, init: isInit }) =>
        isInit || ["input", "read"].includes(referenceUse(sourceCode, identifier)),
    )
    ? array
    : null;
}

function hasDynamicArguments(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const array = staticArray(sourceCode, node);

  return array === null
    ? true
    : array.elements.some((element) => element !== null && isDynamic(sourceCode, element));
}

function aliasVariable(sourceCode: SourceCode, identifier: ESTree.Node): Variable | null {
  const declarator = outermostExpression(identifier).parent;

  const alias =
    declarator?.type === "VariableDeclarator" && declarator.id.type === "Identifier"
      ? variableFor(sourceCode, declarator.id)
      : null;

  return alias !== null && unchangedInit(alias) !== null ? alias : null;
}

function isWrittenTo(sourceCode: SourceCode, variable: Variable): boolean {
  const pending = [variable];
  const checked = new Set<Variable>();

  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    if (checked.has(current)) {
      continue;
    }

    checked.add(current);

    for (const { identifier, init } of current.references) {
      const use = init ? "read" : referenceUse(sourceCode, identifier);
      const alias = use === "alias" ? aliasVariable(sourceCode, identifier) : null;

      if (use === "write") {
        return true;
      }

      if (alias !== null) {
        pending.push(alias);
      }
    }
  }

  return false;
}

function optionsObject(sourceCode: SourceCode, node: ESTree.Node): ESTree.ObjectExpression | null {
  const { value, variables } = constChain(sourceCode, node);

  return value.type === "ObjectExpression" &&
    !variables.some((variable) => isWrittenTo(sourceCode, variable))
    ? value
    : null;
}

function enablesShell(
  sourceCode: SourceCode,
  property: ESTree.ObjectExpression["properties"][number],
): boolean {
  if (property.type !== "Property" || staticPropertyName(property) !== "shell") {
    return false;
  }

  const { value } = constChain(sourceCode, property.value);

  if (value.type === "Literal" && typeof value.value === "boolean") {
    return value.value;
  }

  return Boolean(constantString(sourceCode, value));
}

function shellOption(sourceCode: SourceCode, call: ESTree.CallExpression): ShellOption | null {
  for (const [index, argument] of call.arguments.entries()) {
    const options = optionsObject(sourceCode, argument);
    const property = options?.properties.find((candidate) => enablesShell(sourceCode, candidate));

    if (property !== undefined) {
      return { node: options === unwrapExpression(argument) ? property : argument, index };
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
        const name = childProcessCallee(sourceCode, node.callee);

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
