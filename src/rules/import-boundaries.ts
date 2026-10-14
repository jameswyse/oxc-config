import { dirname, resolve as resolvePath } from "node:path";

import { defineRule } from "@oxlint/plugins";

import { isGlobal, matchesAny, projectPath, propertyName, variableFor } from "../shared/index.ts";

import type { ESTree, Options, SourceCode } from "@oxlint/plugins";

type OptionValue = Options[number];

type Boundary = {
  readonly files: readonly string[];
  readonly ignore: readonly string[];
  readonly deny: readonly string[];
  readonly message: string;
  readonly types: boolean;
};

function isStringList(value: OptionValue | undefined): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseBoundary(value: OptionValue): Boundary {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Each import boundary must be an object.");
  }

  const { files, ignore = [], deny, message, types = false } = value;

  if (
    !isStringList(files) ||
    !isStringList(ignore) ||
    !isStringList(deny) ||
    typeof message !== "string" ||
    typeof types !== "boolean"
  ) {
    throw new TypeError("Each import boundary needs files, deny and message settings.");
  }

  return { files, ignore, deny, message, types };
}

type BoundarySettings = {
  readonly root: string;
  readonly boundaries: readonly Boundary[];
};

function parseSettings(options: Readonly<Options>): BoundarySettings {
  const [option] = options;

  if (
    typeof option !== "object" ||
    option === null ||
    Array.isArray(option) ||
    typeof option.root !== "string" ||
    !Array.isArray(option.boundaries)
  ) {
    throw new TypeError("Configure import boundaries with a root and a boundaries array.");
  }

  return { root: option.root, boundaries: option.boundaries.map(parseBoundary) };
}

function isRequire(sourceCode: SourceCode, callee: ESTree.Node): boolean {
  if (isGlobal(sourceCode, callee, "require")) {
    return true;
  }

  const definition = variableFor(sourceCode, callee)?.defs[0];
  const init = definition?.node.type === "VariableDeclarator" ? definition.node.init : null;
  const factory = init?.type === "CallExpression" ? init.callee : null;

  return (
    (factory?.type === "Identifier" && factory.name === "createRequire") ||
    (factory?.type === "MemberExpression" && propertyName(factory) === "createRequire")
  );
}

export const importBoundaries = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Keep modules from importing across configured boundaries." },
    schema: [
      {
        type: "object",
        properties: {
          root: { type: "string" },
          boundaries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                files: { type: "array", items: { type: "string" } },
                ignore: { type: "array", items: { type: "string" } },
                deny: { type: "array", items: { type: "string" } },
                message: { type: "string" },
                types: { type: "boolean" },
              },
              required: ["files", "deny", "message"],
              additionalProperties: false,
            },
          },
        },
        required: ["root", "boundaries"],
        additionalProperties: false,
      },
    ],
    messages: { boundary: "Do not import '{{specifier}}' here. {{message}}" },
  },
  create(context) {
    const { root, boundaries } = parseSettings(context.options);
    const file = projectPath(root, context.filename);

    const active = boundaries.filter(
      (boundary) => matchesAny(file, boundary.files) && !matchesAny(file, boundary.ignore),
    );

    if (active.length === 0) {
      return {};
    }

    function check(source: ESTree.Node | null | undefined, typeOnly: boolean): void {
      if (source?.type !== "Literal" || typeof source.value !== "string") {
        return;
      }

      const specifier = source.value;

      const target = specifier.startsWith(".")
        ? projectPath(root, resolvePath(dirname(context.filename), specifier))
        : specifier;

      const boundary = active.find(
        ({ deny, types }) => (types || !typeOnly) && matchesAny(target, deny),
      );

      if (boundary) {
        context.report({
          node: source,
          messageId: "boundary",
          data: { specifier, message: boundary.message },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        check(
          node.source,
          node.importKind === "type" ||
            (node.specifiers.length > 0 &&
              node.specifiers.every(
                (specifier) =>
                  specifier.type === "ImportSpecifier" && specifier.importKind === "type",
              )),
        );
      },
      ExportNamedDeclaration(node) {
        check(node.source, node.exportKind === "type");
      },
      ExportAllDeclaration(node) {
        check(node.source, node.exportKind === "type");
      },
      ImportExpression(node) {
        check(node.source, false);
      },
      TSImportType(node) {
        check(node.source, true);
      },
      TSExternalModuleReference(node) {
        check(
          node.expression,
          node.parent.type === "TSImportEqualsDeclaration" && node.parent.importKind === "type",
        );
      },
      CallExpression(node) {
        const [source] = node.arguments;

        if (node.arguments.length === 1 && isRequire(context.sourceCode, node.callee)) {
          check(source, false);
        }
      },
    };
  },
});
