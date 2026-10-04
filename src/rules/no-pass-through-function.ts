import { defineRule } from "@oxlint/plugins";

import { propertyName, variableFor } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type FunctionNode = ESTree.Function | ESTree.ArrowFunctionExpression;

type NamedFunction = {
  readonly node: ESTree.Node;
  readonly name: string;
};

function delegatedCall(fn: FunctionNode): ESTree.CallExpression | null {
  let expression: ESTree.FunctionBody | ESTree.Expression | null = fn.body;

  if (expression?.type === "BlockStatement") {
    const [statement, ...otherStatements] = expression.body;

    if (statement === undefined || otherStatements.length > 0) {
      return null;
    }

    if (statement.type === "ReturnStatement") {
      expression = statement.argument;
    } else if (statement.type === "ExpressionStatement" && !statement.directive) {
      expression = statement.expression;
    } else {
      return null;
    }
  }

  if (expression?.type === "AwaitExpression") {
    expression = expression.argument;
  }

  return expression?.type === "CallExpression" && !expression.optional ? expression : null;
}

function passesParameters(fn: FunctionNode, call: ESTree.CallExpression): boolean {
  if (fn.params.length !== call.arguments.length) {
    return false;
  }

  return fn.params.every((parameter, index) => {
    const argument = call.arguments[index];

    if (parameter.type === "Identifier") {
      return argument?.type === "Identifier" && argument.name === parameter.name;
    }

    return (
      parameter.type === "RestElement" &&
      parameter.argument.type === "Identifier" &&
      argument?.type === "SpreadElement" &&
      argument.argument.type === "Identifier" &&
      argument.argument.name === parameter.argument.name
    );
  });
}

function isEffectEvent(sourceCode: SourceCode, callee: ESTree.IdentifierReference): boolean {
  const definition = variableFor(sourceCode, callee)?.defs[0]?.node;
  const init = definition?.type === "VariableDeclarator" ? definition.init : null;
  const hook = init?.type === "CallExpression" ? init.callee : null;

  if (hook?.type === "MemberExpression") {
    return propertyName(hook) === "useEffectEvent";
  }

  return hook?.type === "Identifier" && hook.name === "useEffectEvent";
}

function namedFunction(fn: FunctionNode): NamedFunction | null {
  const parent = fn.parent;

  if (fn.type === "FunctionDeclaration") {
    return fn.id ? { node: fn.id, name: fn.id.name } : null;
  }

  if (
    parent.type === "VariableDeclarator" &&
    parent.init === fn &&
    parent.id.type === "Identifier"
  ) {
    return { node: parent.id, name: parent.id.name };
  }

  if (
    (parent.type === "MethodDefinition" && parent.kind === "method") ||
    (parent.type === "PropertyDefinition" && parent.value === fn)
  ) {
    const name = propertyName(parent);

    return name ? { node: parent.key, name } : null;
  }

  return null;
}

export const noPassThroughFunction = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Report named functions that only forward their parameters to another function.",
    },
    schema: [],
    messages: {
      passThrough:
        "`{{name}}` only forwards its parameters to `{{callee}}`. Call `{{callee}}` directly, or give this function work that justifies it.",
    },
  },
  create(context) {
    function check(fn: FunctionNode): void {
      if (
        fn.generator ||
        fn.params.length === 0 ||
        fn.returnType?.typeAnnotation.type === "TSTypePredicate"
      ) {
        return;
      }

      const named = namedFunction(fn);

      if (named === null) {
        return;
      }

      const call = delegatedCall(fn);

      if (
        call?.callee.type === "Identifier" &&
        passesParameters(fn, call) &&
        !isEffectEvent(context.sourceCode, call.callee)
      ) {
        context.report({
          node: named.node,
          messageId: "passThrough",
          data: { name: named.name, callee: call.callee.name },
        });
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
