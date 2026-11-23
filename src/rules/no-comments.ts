import { defineRule } from "@oxlint/plugins";

import {
  childNodes,
  matchesAny,
  projectPath,
  unwrapExpression,
  variableFor,
} from "../shared/index.ts";
import { isPublicClassMember, locallyExportedNames } from "../shared/module-exports.ts";
import { optionStrings } from "../shared/rule-options.ts";

import type { Comment, ESTree, Options, SourceCode } from "@oxlint/plugins";

import type { ModuleStatement } from "../shared/module-exports.ts";

const directivePatterns = [
  /^(?:oxlint|eslint)-(?:disable|enable)(?:-next-line|-line)?(?:\s|$)/u,
  /^@ts-(?:expect-error|ignore)/u,
  /^@ts-(?:nocheck|check)(?:\s|$)/u,
  /^@effect-diagnostics/u,
  /^\/\s*<(?:reference|amd-module|amd-dependency)\s/u,
  /^[#@]__(?:PURE|NO_SIDE_EFFECTS|INLINE|NOINLINE|KEY|MANGLE_PROP)__$/u,
  /^(?:oxfmt|prettier|biome)-ignore(?:-start|-end|-all)?(?:\s|$)/u,
  /^(?:c8|v8|istanbul)\s+ignore(?:\s|$)/u,
  /^@vite-ignore$/u,
  /^webpack[A-Z]\w*:/u,
  /^@(?:vitest|jest)-environment\s/u,
  /^@jsx(?:ImportSource|Runtime|Frag)?\s/u,
  /^nosemgrep(?::\s*[\w./-]+(?:\s*,\s*[\w./-]+)*)?$/u,
  /^[#@]\s*source(?:Mapping)?URL=\S+$/u,
  /^SPDX-License-Identifier:\s*\S/u,
];

const licenceTag = /@(?:license|preserve)\b/u;

const leadingLicenceTag = /^@(?:license|preserve)\b/u;

const warningText = /^WARNING:\s*\S/u;

const nonPublicTag = /@(?:internal|private)\b/u;

const leadingWhitespace = /\s*/uy;

function commentText(comment: Comment) {
  return comment.value
    .split("\n")
    .map((line) => line.replace(/^\s*\*?/u, "").trim())
    .filter((line) => line.length > 0)
    .join(" ");
}

function isLicence(comment: Comment) {
  if (comment.type === "Line") {
    return leadingLicenceTag.test(comment.value.trim());
  }

  return (
    comment.type === "Block" && (comment.value.startsWith("!") || licenceTag.test(comment.value))
  );
}

function isWarning(comment: Comment) {
  return comment.type === "Line" && warningText.test(comment.value.trim());
}

function isDocBlock(comment: Comment) {
  return comment.type === "Block" && comment.value.startsWith("*");
}

const javaScriptFile = /\.(?:js|jsx|mjs|cjs)$/u;

const typeTag =
  /@(?:(?:type|typedef|callback|template|satisfies|import|overload|this|enum|extends|augments|implements)\b|(?:param|arg|argument|returns?|property|prop)\s+\{)/u;

function isTypeAnnotation(comment: Comment) {
  return isDocBlock(comment) && typeTag.test(comment.value);
}

function hasOption(options: Readonly<Options>, key: string) {
  const [option] = options;

  return typeof option === "object" && option !== null && !Array.isArray(option) && key in option;
}

type VisitorKeys = SourceCode["visitorKeys"];

function declaredNames(statement: ModuleStatement) {
  if (statement.type === "VariableDeclaration") {
    return statement.declarations.flatMap((declarator) =>
      declarator.id.type === "Identifier" ? [declarator.id.name] : [],
    );
  }

  return "id" in statement && statement.id?.type === "Identifier" ? [statement.id.name] : [];
}

function exportedDeclaration(statement: ModuleStatement) {
  if (
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration"
  ) {
    return statement.declaration;
  }

  if (statement.type === "TSExportAssignment") {
    return statement.expression;
  }

  return statement.type === "ExportAllDeclaration" ? null : statement;
}

function isExportStatement(statement: ModuleStatement) {
  return (
    statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration" ||
    statement.type === "ExportAllDeclaration" ||
    statement.type === "TSExportAssignment"
  );
}

function moduleBlock(declaration: ESTree.TSModuleDeclaration | ESTree.TSGlobalDeclaration) {
  return declaration.body?.type === "TSModuleBlock" ? declaration.body : null;
}

function ambientBlock(statement: ModuleStatement) {
  return statement.type === "TSModuleDeclaration" &&
    (statement.global || statement.id.type === "Literal")
    ? moduleBlock(statement)
    : null;
}

function valueMembers(node: ESTree.Node | null): ESTree.Node[] {
  const value = node ? unwrapExpression(node) : null;

  if (value?.type === "ClassDeclaration" || value?.type === "ClassExpression") {
    return value.body.body.filter(isPublicClassMember);
  }

  if (value?.type !== "ObjectExpression") {
    return [];
  }

  return value.properties.flatMap((property) =>
    property.type === "Property" ? [property, ...valueMembers(property.value)] : [],
  );
}

function typeMembers(node: ESTree.Node, visitorKeys: VisitorKeys): ESTree.Node[] {
  const holdsMembers = node.type === "TSTypeLiteral" || node.type === "TSInterfaceBody";

  return childNodes(node, visitorKeys).flatMap((child) => [
    ...(holdsMembers ? [child] : []),
    ...typeMembers(child, visitorKeys),
  ]);
}

function publicMembers(declaration: ESTree.Node, visitorKeys: VisitorKeys) {
  if (declaration.type === "TSEnumDeclaration") {
    return declaration.body.members;
  }

  if (declaration.type === "VariableDeclaration") {
    return declaration.declarations.flatMap((declarator) =>
      declarator.init ? valueMembers(declarator.init) : [],
    );
  }

  if (
    declaration.type === "TSInterfaceDeclaration" ||
    declaration.type === "TSTypeAliasDeclaration"
  ) {
    return typeMembers(declaration, visitorKeys);
  }

  return valueMembers(declaration);
}

type HeritageDeclaration =
  | ESTree.TSInterfaceDeclaration
  | ESTree.TSTypeAliasDeclaration
  | ESTree.Class;

function isHeritageDeclaration(node: ESTree.Node): node is HeritageDeclaration {
  return (
    node.type === "TSInterfaceDeclaration" ||
    node.type === "TSTypeAliasDeclaration" ||
    node.type === "ClassDeclaration" ||
    node.type === "ClassExpression"
  );
}

function intersectedTypeReferences(type: ESTree.TSType): ESTree.Node[] {
  if (type.type === "TSIntersectionType") {
    return type.types.flatMap(intersectedTypeReferences);
  }

  return type.type === "TSTypeReference" ? [type.typeName] : [];
}

function heritageReferences(declaration: HeritageDeclaration): ESTree.Node[] {
  if (declaration.type === "TSTypeAliasDeclaration") {
    return intersectedTypeReferences(declaration.typeAnnotation);
  }

  if (declaration.type === "TSInterfaceDeclaration") {
    return declaration.extends.map((heritage) => heritage.expression);
  }

  const implemented = (declaration.implements ?? []).map((heritage) => heritage.expression);

  return declaration.superClass ? [declaration.superClass, ...implemented] : implemented;
}

function inheritedTypeReferences(node: ESTree.Node | null): ESTree.Node[] {
  const value = node ? unwrapExpression(node) : null;

  if (
    value?.type === "TSInterfaceDeclaration" ||
    value?.type === "ClassDeclaration" ||
    value?.type === "ClassExpression"
  ) {
    return heritageReferences(value);
  }

  if (value?.type === "VariableDeclaration") {
    return value.declarations.flatMap((declarator) => inheritedTypeReferences(declarator.init));
  }

  return [];
}

function qualifiedName(reference: ESTree.Node) {
  if (reference.type === "MemberExpression" && reference.property.type === "Identifier") {
    return { qualifier: reference.object, member: reference.property.name };
  }

  return reference.type === "TSQualifiedName"
    ? { qualifier: reference.left, member: reference.right.name }
    : null;
}

function exportedNamespaceMembers(namespace: ESTree.Node, name: string) {
  const block = namespace.type === "TSModuleDeclaration" ? moduleBlock(namespace) : null;

  return (block?.body ?? []).flatMap((statement) =>
    statement.type === "ExportNamedDeclaration" &&
    statement.declaration !== null &&
    declaredNames(statement.declaration).includes(name)
      ? [statement.declaration]
      : [],
  );
}

function referencedDeclarations(sourceCode: SourceCode, reference: ESTree.Node): ESTree.Node[] {
  if (reference.type === "Identifier") {
    return variableFor(sourceCode, reference)?.defs.map((definition) => definition.node) ?? [];
  }

  const qualified = qualifiedName(reference);

  return qualified === null
    ? []
    : referencedDeclarations(sourceCode, qualified.qualifier).flatMap((namespace) =>
        exportedNamespaceMembers(namespace, qualified.member),
      );
}

function declarationStatement(declaration: HeritageDeclaration): ModuleStatement {
  return declaration.parent.type === "ExportNamedDeclaration" ? declaration.parent : declaration;
}

function publicApiStarts(program: ESTree.Program, sourceCode: SourceCode) {
  const { visitorKeys } = sourceCode;
  const starts = new Set<number>();
  const inheritedReferences: ESTree.Node[] = [];
  const statementLists: (readonly ModuleStatement[])[] = [program.body];

  const addStatement = (statement: ModuleStatement) => {
    const declaration = exportedDeclaration(statement);
    const decorators = declaration && "decorators" in declaration ? declaration.decorators : [];

    starts.add(Math.min(statement.start, ...decorators.map((decorator) => decorator.start)));

    if (declaration === null) {
      return;
    }

    for (const member of publicMembers(declaration, visitorKeys)) {
      starts.add(member.start);
    }

    const block = declaration.type === "TSModuleDeclaration" ? moduleBlock(declaration) : null;

    if (block !== null) {
      statementLists.push(block.body);
    }
  };

  const addPublicStatement = (statement: ModuleStatement) => {
    addStatement(statement);
    inheritedReferences.push(...inheritedTypeReferences(exportedDeclaration(statement)));
  };

  for (const statements of statementLists) {
    const exported = locallyExportedNames(statements);

    for (const statement of statements) {
      const ambient = ambientBlock(statement);

      if (ambient !== null) {
        ambient.body.forEach(addPublicStatement);
      } else if (
        isExportStatement(statement) ||
        declaredNames(statement).some((name) => exported.has(name))
      ) {
        addPublicStatement(statement);
      }
    }
  }

  const reached = new Set<HeritageDeclaration>();

  for (const reference of inheritedReferences) {
    for (const declaration of referencedDeclarations(sourceCode, reference)) {
      if (isHeritageDeclaration(declaration) && !reached.has(declaration)) {
        reached.add(declaration);
        addStatement(declarationStatement(declaration));
        inheritedReferences.push(...heritageReferences(declaration));
      }
    }
  }

  return starts;
}

export const noComments = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Express intent in code instead of comments; allow tool directives, warning comments, TSDoc on exported API and JavaScript type annotations.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allow: { type: "array", items: { type: "string" } },
          publicApi: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      comment:
        "Remove this comment and carry intent in a name, type or test, with any reason in the commit message. Only tool directives, single-line `// WARNING:` comments for dangerous footguns and TSDoc on exported API may stay.",
    },
  },
  create(context) {
    const allowed = [
      ...directivePatterns,
      // oxlint-disable-next-line wyse/no-dynamic-regex -- the allow option takes patterns from the project's lint config
      ...optionStrings(context.options, "allow").map((source) => new RegExp(source, "u")),
    ];

    const typedDocs = javaScriptFile.test(context.filename);

    const publicDocs =
      !hasOption(context.options, "publicApi") ||
      matchesAny(
        projectPath(context.cwd, context.filename),
        optionStrings(context.options, "publicApi"),
      );

    const isDirective = (comment: Comment) =>
      isLicence(comment) || allowed.some((pattern) => pattern.test(commentText(comment)));

    return {
      Program(program) {
        const { text } = context.sourceCode;
        const comments = context.sourceCode.getAllComments();
        const commentsByStart = new Map(comments.map((comment) => [comment.start, comment]));

        const publicApi = publicDocs
          ? publicApiStarts(program, context.sourceCode)
          : new Set<number>();

        const codeAfter = (comment: Comment) => {
          let position = comment.end;

          for (;;) {
            leadingWhitespace.lastIndex = position;
            leadingWhitespace.test(text);
            position = leadingWhitespace.lastIndex;

            const next = commentsByStart.get(position);

            if (next === undefined || !isDirective(next)) {
              return position;
            }

            position = next.end;
          }
        };

        const isPublicTsDoc = (comment: Comment) =>
          isDocBlock(comment) &&
          !nonPublicTag.test(comment.value) &&
          publicApi.has(codeAfter(comment));

        for (const comment of comments) {
          if (
            comment.type === "Shebang" ||
            (typedDocs && isTypeAnnotation(comment)) ||
            isWarning(comment) ||
            isDirective(comment) ||
            isPublicTsDoc(comment)
          ) {
            continue;
          }

          context.report({ loc: comment.loc, messageId: "comment" });
        }
      },
    };
  },
});
