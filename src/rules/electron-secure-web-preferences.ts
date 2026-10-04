import { defineRule } from "@oxlint/plugins";

import { variableFor } from "../shared/index.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type Preference = readonly [name: string, expected: boolean | string];

type Setting = {
  readonly property: ESTree.ObjectProperty | null;
  readonly known: boolean;
};

const hardenedPreferences: readonly Preference[] = [
  ["contextIsolation", true],
  ["sandbox", true],
  ["nodeIntegration", false],
];

const dangerousPreferences: readonly Preference[] = [
  ["allowRunningInsecureContent", false],
  ["enableBlinkFeatures", ""],
  ["enableRemoteModule", false],
  ["experimentalFeatures", false],
  ["nodeIntegrationInSubFrames", false],
  ["nodeIntegrationInWorker", false],
  ["webSecurity", true],
  ["webviewTag", false],
];

function unwrap(node: ESTree.Node | null | undefined): ESTree.Node | null | undefined {
  if (
    node?.type === "TSAsExpression" ||
    node?.type === "TSSatisfiesExpression" ||
    node?.type === "TSNonNullExpression" ||
    node?.type === "TSTypeAssertion"
  ) {
    return unwrap(node.expression);
  }

  return node;
}

function keyName(property: ESTree.ObjectProperty): string | null {
  if (!property.computed && property.key.type === "Identifier") {
    return property.key.name;
  }

  return property.key.type === "Literal" ? String(property.key.value) : null;
}

function setting(object: ESTree.ObjectExpression, name: string): Setting {
  let property: ESTree.ObjectProperty | null = null;
  let known = true;

  for (const candidate of object.properties) {
    const key = candidate.type === "Property" ? keyName(candidate) : null;

    if (candidate.type === "Property" && key === name) {
      property = candidate;
      known = true;
    } else if (key === null) {
      known = false;
    }
  }

  return { property, known };
}

function hasValue(property: ESTree.ObjectProperty | null, expected: boolean | string): boolean {
  const value = unwrap(property?.value);

  return value?.type === "Literal" && value.value === expected;
}

function objectFor(
  sourceCode: SourceCode,
  node: ESTree.Node | null | undefined,
): ESTree.ObjectExpression | null {
  const value = unwrap(node);

  if (value?.type === "ObjectExpression") {
    return value;
  }

  if (value?.type !== "Identifier") {
    return null;
  }

  const definitions = variableFor(sourceCode, value)?.defs ?? [];
  const definition = definitions.length === 1 ? definitions[0] : null;

  return definition?.type === "Variable" &&
    definition.parent?.type === "VariableDeclaration" &&
    definition.parent.kind === "const" &&
    definition.node.type === "VariableDeclarator" &&
    definition.node.id.type === "Identifier"
    ? objectFor(sourceCode, definition.node.init)
    : null;
}

export const electronSecureWebPreferences = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Require hardened Electron webPreferences." },
    schema: [],
    messages: {
      insecure:
        "Set webPreferences contextIsolation: true, sandbox: true and nodeIntegration: false explicitly, with nothing spread after them.",
      dangerous: 'Do not enable the dangerous Electron webPreference "{{name}}".',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      ObjectExpression(node) {
        const { property } = setting(node, "webPreferences");

        if (!property) {
          return;
        }

        const webPreferences = objectFor(sourceCode, property.value);

        if (!webPreferences) {
          return;
        }

        const hardened = hardenedPreferences.every(([name, expected]) => {
          const preference = setting(webPreferences, name);

          return preference.known && hasValue(preference.property, expected);
        });

        if (!hardened) {
          context.report({ node: property.value, messageId: "insecure" });
        }

        for (const [name, safe] of dangerousPreferences) {
          const preference = setting(webPreferences, name).property;

          if (preference && !hasValue(preference, safe)) {
            context.report({ node: preference, messageId: "dangerous", data: { name } });
          }
        }
      },
    };
  },
});
