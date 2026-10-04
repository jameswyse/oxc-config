import { defineRule } from "@oxlint/plugins";

import { optionStrings } from "../shared/rule-options.ts";

import type { ESTree } from "@oxlint/plugins";

type ServerAction = ESTree.Function | ESTree.ArrowFunctionExpression;

type BodyStatement = ESTree.Directive | ESTree.Statement;

function hasDirective(statements: readonly BodyStatement[], directive: string): boolean {
  return statements.some(
    (statement) => statement.type === "ExpressionStatement" && statement.directive === directive,
  );
}

function firstStatement(statements: readonly BodyStatement[]): BodyStatement | undefined {
  return statements.find(
    (statement) => statement.type !== "ExpressionStatement" || !statement.directive,
  );
}

function awaitsGuard(
  expression: ESTree.Expression | null | undefined,
  guards: ReadonlySet<string>,
): boolean {
  return (
    expression?.type === "AwaitExpression" &&
    expression.argument.type === "CallExpression" &&
    expression.argument.callee.type === "Identifier" &&
    guards.has(expression.argument.callee.name)
  );
}

function startsWithGuard(action: ServerAction, guards: ReadonlySet<string>): boolean {
  if (action.body?.type !== "BlockStatement") {
    return false;
  }

  const statement = firstStatement(action.body.body);

  if (statement?.type === "ExpressionStatement") {
    return awaitsGuard(statement.expression, guards);
  }

  return (
    statement?.type === "VariableDeclaration" &&
    awaitsGuard(statement.declarations[0]?.init, guards)
  );
}

function functionName(node: ServerAction): string {
  if (node.id?.type === "Identifier") {
    return node.id.name;
  }

  return node.parent.type === "VariableDeclarator" && node.parent.id.type === "Identifier"
    ? node.parent.id.name
    : "this action";
}

export const serverActionGuard = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require every server action to start by awaiting an access guard." },
    schema: [
      {
        type: "object",
        properties: { guards: { type: "array", items: { type: "string" }, minItems: 1 } },
        required: ["guards"],
        additionalProperties: false,
      },
    ],
    messages: {
      missingGuard:
        "Server actions can be called directly. Start `{{name}}` by awaiting an access guard: {{guards}}.",
      exportWhereDeclared:
        "Export each server action where it's declared, so this rule can check it starts with an access guard.",
    },
  },
  create(context) {
    const guards = new Set(optionStrings(context.options, "guards"));
    const guardList = [...guards].join(", ");
    let isServerModule = false;

    function requireGuard(action: ServerAction): void {
      if (!startsWithGuard(action, guards)) {
        context.report({
          node: action,
          messageId: "missingGuard",
          data: { name: functionName(action), guards: guardList },
        });
      }
    }

    function checkInline(node: ServerAction): void {
      if (
        !isServerModule &&
        node.body?.type === "BlockStatement" &&
        hasDirective(node.body.body, "use server")
      ) {
        requireGuard(node);
      }
    }

    return {
      Program(program) {
        isServerModule = hasDirective(program.body, "use server");
      },
      ExportDefaultDeclaration(node) {
        if (isServerModule) {
          context.report({ node, messageId: "exportWhereDeclared" });
        }
      },
      ExportNamedDeclaration(node) {
        if (!isServerModule || node.exportKind === "type") {
          return;
        }

        const declaration = node.declaration;

        if (declaration === null) {
          context.report({ node, messageId: "exportWhereDeclared" });
        } else if (declaration.type === "FunctionDeclaration") {
          requireGuard(declaration);
        } else if (declaration.type === "VariableDeclaration") {
          for (const declarator of declaration.declarations) {
            const action = declarator.init;

            if (
              action?.type === "ArrowFunctionExpression" ||
              action?.type === "FunctionExpression"
            ) {
              requireGuard(action);
            } else {
              context.report({ node: declarator, messageId: "exportWhereDeclared" });
            }
          }
        }
      },
      FunctionDeclaration: checkInline,
      FunctionExpression: checkInline,
      ArrowFunctionExpression: checkInline,
    };
  },
});
