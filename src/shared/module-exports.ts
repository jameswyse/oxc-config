import type { ESTree } from "@oxlint/plugins";

export type ModuleStatement = ESTree.Program["body"][number];

function localExports(statement: ModuleStatement) {
  if (statement.type === "ExportNamedDeclaration" && statement.source === null) {
    return statement.specifiers.flatMap((specifier) =>
      specifier.local.type === "Identifier"
        ? [
            {
              name: specifier.local.name,
              typeOnly: statement.exportKind === "type" || specifier.exportKind === "type",
            },
          ]
        : [],
    );
  }

  const exported =
    statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement.type === "TSExportAssignment"
        ? statement.expression
        : null;

  return exported?.type === "Identifier" ? [{ name: exported.name, typeOnly: false }] : [];
}

export function locallyExportedNames(statements: readonly ModuleStatement[]): ReadonlySet<string> {
  return new Set(statements.flatMap(localExports).map(({ name }) => name));
}

export function locallyExportedValueNames(
  statements: readonly ModuleStatement[],
): ReadonlySet<string> {
  return new Set(
    statements.flatMap(localExports).flatMap(({ name, typeOnly }) => (typeOnly ? [] : [name])),
  );
}

export function isEmittedClassMember(member: ESTree.ClassElement): boolean {
  return (
    member.type !== "StaticBlock" &&
    member.accessibility !== "private" &&
    !("key" in member && member.key.type === "PrivateIdentifier")
  );
}

export function isPublicClassMember(member: ESTree.ClassElement): boolean {
  return (
    isEmittedClassMember(member) &&
    member.type !== "StaticBlock" &&
    member.accessibility !== "protected"
  );
}
