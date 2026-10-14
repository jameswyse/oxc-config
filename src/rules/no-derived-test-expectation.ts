import { dirname, join } from "node:path";

import { defineRule } from "@oxlint/plugins";

import {
  apiReference,
  childNodes,
  projectPath,
  propertyName,
  variableFor,
} from "../shared/index.ts";

import type { ESTree, SourceCode, Variable } from "@oxlint/plugins";

const comparisonMatchers = new Set([
  "toBe",
  "toEqual",
  "toStrictEqual",
  "toMatchObject",
  "toContain",
  "toContainEqual",
  "toMatch",
  "toHaveProperty",
  "toBeCloseTo",
]);

const testSupport =
  /(?:^|[/.])(?:tests?|__tests__|e2e|testing|fixtures?|mocks?|fakes?|stubs?|builders?|factories|support|helpers?)(?:[/.]|$)/u;

const projectSpecifier = /^(?:\.{1,2}\/|@\/|~\/|#)/u;

function isProductionImport(
  sourceCode: SourceCode,
  directory: string,
  callee: ESTree.Node,
): boolean {
  const definition = variableFor(sourceCode, callee)?.defs[0];
  const declaration = definition?.parent;

  if (definition?.type !== "ImportBinding" || declaration?.type !== "ImportDeclaration") {
    return false;
  }

  const source = declaration.source.value;
  const path = source.startsWith(".") ? join(directory, source) : source;

  return projectSpecifier.test(source) && !testSupport.test(path.replaceAll("\\", "/"));
}

function calledName(sourceCode: SourceCode, directory: string, callee: ESTree.Node): string | null {
  if (callee.type === "Identifier") {
    return isProductionImport(sourceCode, directory, callee) ? callee.name : null;
  }

  const name = callee.type === "MemberExpression" ? propertyName(callee) : null;
  const namespace = callee.type === "MemberExpression" ? callee.object : null;

  return namespace?.type === "Identifier" &&
    name !== null &&
    variableFor(sourceCode, namespace)?.defs[0]?.node.type === "ImportNamespaceSpecifier" &&
    isProductionImport(sourceCode, directory, namespace)
    ? `${namespace.name}.${name}`
    : null;
}

type Constant = { readonly variable: Variable; readonly value: ESTree.Node };

function constantValue(sourceCode: SourceCode, node: ESTree.Node): Constant | null {
  const variable = node.type === "Identifier" ? variableFor(sourceCode, node) : null;
  const definition = variable?.defs[0];

  return variable !== null &&
    definition?.type === "Variable" &&
    definition.parent?.type === "VariableDeclaration" &&
    definition.parent.kind === "const" &&
    definition.node.type === "VariableDeclarator" &&
    definition.node.id.type === "Identifier" &&
    definition.node.init !== null
    ? { variable, value: definition.node.init }
    : null;
}

function isExpectedArgument(node: ESTree.Node): boolean {
  const call = node.parent;

  return (
    call?.type === "CallExpression" &&
    call.arguments.some((argument) => argument === node) &&
    call.callee.type === "MemberExpression" &&
    comparisonMatchers.has(propertyName(call.callee) ?? "")
  );
}

function subjectRoots(sourceCode: SourceCode, argument: ESTree.Node): ESTree.Node[] {
  const constant = constantValue(sourceCode, argument);

  return constant === null ? [argument] : [argument, constant.value];
}

function expectedRoot(sourceCode: SourceCode, argument: ESTree.Node): ESTree.Node {
  const constant = constantValue(sourceCode, argument);

  return constant !== null &&
    constant.variable.references.every(
      (reference) => !reference.isRead() || isExpectedArgument(reference.identifier),
    )
    ? constant.value
    : argument;
}

function productionCalls(sourceCode: SourceCode, directory: string, root: ESTree.Node): string[] {
  const names: string[] = [];
  const pending = [root];

  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    const name =
      node.type === "CallExpression" ? calledName(sourceCode, directory, node.callee) : null;

    if (name !== null) {
      names.push(name);
    }

    if (node.type !== "ArrowFunctionExpression" && node.type !== "FunctionExpression") {
      pending.push(...childNodes(node, sourceCode.visitorKeys));
    }
  }

  return names;
}

function positiveExpectation(
  sourceCode: SourceCode,
  node: ESTree.Node,
): ESTree.CallExpression | null {
  let current = node;

  while (current.type === "MemberExpression") {
    if (propertyName(current) === "not") {
      return null;
    }

    current = current.object;
  }

  return current.type === "CallExpression" &&
    apiReference(sourceCode, current.callee)?.name === "expect"
    ? current
    : null;
}

export const noDerivedTestExpectation = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow expected values computed by the production code under test.",
    },
    schema: [],
    messages: {
      derived:
        "The expected value calls `{{name}}` from production code, so a bug in it changes both sides and the assertion still passes. Write the expected value out, or derive it independently.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const directory = dirname(projectPath(context.cwd, context.filename));

    return {
      CallExpression(node) {
        const matcher = node.callee.type === "MemberExpression" ? propertyName(node.callee) : null;

        const expectation =
          node.callee.type === "MemberExpression" &&
          matcher !== null &&
          comparisonMatchers.has(matcher)
            ? positiveExpectation(sourceCode, node.callee.object)
            : null;

        if (expectation === null) {
          return;
        }

        const subjectCalls = new Set(
          expectation.arguments
            .flatMap((argument) => subjectRoots(sourceCode, argument))
            .flatMap((root) => productionCalls(sourceCode, directory, root)),
        );

        for (const argument of node.arguments) {
          const name = productionCalls(
            sourceCode,
            directory,
            expectedRoot(sourceCode, argument),
          ).find((call) => !subjectCalls.has(call));

          if (name !== undefined) {
            context.report({ node: argument, messageId: "derived", data: { name } });

            return;
          }
        }
      },
    };
  },
});
