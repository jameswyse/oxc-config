import { defineRule } from "@oxlint/plugins";

import { isGlobalValue, isInjectionSeam, propertyName, variableFor } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

const cryptoModules = ["node:crypto", "crypto"];

const webRandom = new Set(["randomUUID"]);

const nodeRandom = new Set(["randomUUID", "randomInt"]);

function importedName(specifier: ESTree.ImportSpecifier): string | null {
  return specifier.imported.type === "Identifier" ? specifier.imported.name : null;
}

function cryptoImport(sourceCode: SourceCode, node: ESTree.Node): ReadonlySet<string> | null {
  if (node.type !== "Identifier") {
    return null;
  }

  const definition = variableFor(sourceCode, node)?.defs[0];

  if (
    definition?.type !== "ImportBinding" ||
    definition.parent?.type !== "ImportDeclaration" ||
    !cryptoModules.includes(definition.parent.source.value)
  ) {
    return null;
  }

  const specifier = definition.node;

  if (specifier.type === "ImportSpecifier") {
    return importedName(specifier) === "webcrypto" ? webRandom : null;
  }

  return nodeRandom;
}

function randomMembers(sourceCode: SourceCode, node: ESTree.Node): ReadonlySet<string> | null {
  return isGlobalValue(sourceCode, node, "crypto") ? webRandom : cryptoImport(sourceCode, node);
}

export const noAmbientRandom = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Generate random numbers and identifiers only in a random owner." },
    schema: [],
    messages: {
      random:
        "Accept random values or an identifier factory from the caller. If this module owns randomness, add it to the `random` owners.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      MemberExpression(node) {
        const name = propertyName(node);

        if (
          ((name === "random" && isGlobalValue(sourceCode, node.object, "Math")) ||
            (name !== null && randomMembers(sourceCode, node.object)?.has(name))) &&
          !isInjectionSeam(node)
        ) {
          context.report({ node, messageId: "random" });
        }
      },
      ImportDeclaration(node) {
        if (!cryptoModules.includes(node.source.value) || node.importKind === "type") {
          return;
        }

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") {
            continue;
          }

          const name = importedName(specifier);

          if (name === null || !nodeRandom.has(name)) {
            continue;
          }

          for (const variable of sourceCode.getDeclaredVariables(specifier)) {
            for (const { identifier } of variable.references) {
              if (!isInjectionSeam(identifier)) {
                context.report({ node: identifier, messageId: "random" });
              }
            }
          }
        }
      },
    };
  },
});
