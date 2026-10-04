import { defineRule } from "@oxlint/plugins";

import { propertyName } from "../shared/index.ts";

import type { ESTree } from "@oxlint/plugins";

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

type ExportedFunction = {
  readonly name: string;
  readonly fn: FunctionNode;
};

const absentTypes = new Set(["TSUndefinedKeyword", "TSNullKeyword"]);

function isBooleanType(type: ESTree.TSType | undefined): boolean {
  if (type?.type === "TSBooleanKeyword") {
    return true;
  }

  if (type?.type !== "TSUnionType") {
    return false;
  }

  const present = type.types.filter((member) => !absentTypes.has(member.type));

  return present.length === 1 && isBooleanType(present[0]);
}

function booleanParameter(parameter: ESTree.ParamPattern): ESTree.BindingIdentifier | null {
  const target = parameter.type === "TSParameterProperty" ? parameter.parameter : parameter;

  if (target.type === "Identifier") {
    return isBooleanType(target.typeAnnotation?.typeAnnotation) ? target : null;
  }

  if (target.type !== "AssignmentPattern" || target.left.type !== "Identifier") {
    return null;
  }

  const annotation = target.left.typeAnnotation?.typeAnnotation;

  const isBoolean = annotation
    ? isBooleanType(annotation)
    : target.right.type === "Literal" && typeof target.right.value === "boolean";

  return isBoolean ? target.left : null;
}

function isSetter(name: string, fn: FunctionNode, parameter: ESTree.ParamPattern): boolean {
  return (
    /^(?:set|update)\p{Lu}/u.test(name.slice(name.lastIndexOf(".") + 1)) &&
    fn.params.at(-1) === parameter
  );
}

function functionValue(node: ESTree.Expression | null): FunctionNode | null {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression"
    ? node
    : null;
}

function isPublicMember(member: ESTree.MethodDefinition | ESTree.PropertyDefinition): boolean {
  return (
    !member.computed &&
    member.key.type !== "PrivateIdentifier" &&
    member.accessibility !== "private" &&
    member.accessibility !== "protected"
  );
}

function classMembers(declaration: ESTree.Class): ExportedFunction[] {
  const name = declaration.id?.name ?? "default";

  return declaration.body.body.flatMap((member): ExportedFunction[] => {
    if (
      (member.type !== "MethodDefinition" && member.type !== "PropertyDefinition") ||
      !isPublicMember(member)
    ) {
      return [];
    }

    if (member.type === "MethodDefinition" && member.kind !== "set" && member.kind !== "get") {
      return [{ name: `${name}.${propertyName(member)}`, fn: member.value }];
    }

    const value = member.type === "PropertyDefinition" ? functionValue(member.value) : null;

    return value ? [{ name: `${name}.${propertyName(member)}`, fn: value }] : [];
  });
}

function exportedFunctions(declaration: ESTree.Node | null): ExportedFunction[] {
  if (!declaration) {
    return [];
  }

  if (
    declaration.type === "FunctionDeclaration" ||
    declaration.type === "FunctionExpression" ||
    declaration.type === "ArrowFunctionExpression"
  ) {
    return [{ name: declaration.id?.name ?? "default", fn: declaration }];
  }

  if (declaration.type === "ClassDeclaration" || declaration.type === "ClassExpression") {
    return classMembers(declaration);
  }

  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((declarator): ExportedFunction[] => {
      const fn = functionValue(declarator.init);

      return fn && declarator.id.type === "Identifier" ? [{ name: declarator.id.name, fn }] : [];
    });
  }

  return [];
}

export const explicitApiStates = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Avoid boolean control parameters on exported functions and public methods.",
    },
    schema: [],
    messages: {
      boolean:
        "Parameter '{{parameter}}' makes `{{name}}` switch on a positional boolean. Take named options or split it into explicit variants.",
    },
  },
  create(context) {
    function check({ name, fn }: ExportedFunction): void {
      if (!fn.body) {
        return;
      }

      for (const parameter of fn.params) {
        const identifier = booleanParameter(parameter);

        if (identifier && !isSetter(name, fn, parameter)) {
          context.report({
            node: identifier,
            messageId: "boolean",
            data: { parameter: identifier.name, name },
          });
        }
      }
    }

    return {
      Program(program) {
        const exportedNames = new Set<string>();

        for (const statement of program.body) {
          if (statement.type === "ExportNamedDeclaration" && !statement.source) {
            if (statement.exportKind === "type") {
              continue;
            }

            for (const entry of exportedFunctions(statement.declaration)) {
              check(entry);
            }

            for (const specifier of statement.specifiers) {
              if (specifier.exportKind !== "type" && specifier.local.type === "Identifier") {
                exportedNames.add(specifier.local.name);
              }
            }
          }

          if (statement.type === "ExportDefaultDeclaration") {
            if (statement.declaration.type === "Identifier") {
              exportedNames.add(statement.declaration.name);
            } else {
              for (const entry of exportedFunctions(statement.declaration)) {
                check(entry);
              }
            }
          }
        }

        for (const statement of program.body) {
          const owner = statement.type === "ClassDeclaration" ? statement.id?.name : undefined;

          for (const entry of exportedFunctions(statement)) {
            if (exportedNames.has(owner ?? entry.name)) {
              check(entry);
            }
          }
        }
      },
    };
  },
});
