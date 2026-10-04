// Adapted from dmmulroy/anti-slop
import type { ESTree, Scope, SourceCode, Variable } from "@oxlint/plugins";

function resolveVariable(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference | ESTree.BindingIdentifier,
): Variable | null {
  let scope: Scope | null = sourceCode.getScope(identifier);

  while (scope !== null) {
    const variable = scope.set.get(identifier.name);

    if (variable !== void 0) {
      return variable;
    }

    scope = scope.upper;
  }

  return null;
}

export { resolveVariable };
