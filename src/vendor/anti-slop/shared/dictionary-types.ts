import {
  createTypeAliasEnvironment,
  hasVisibleTypeBinding,
  visibleTypeAlias,
} from "./type-alias-resolution.ts";

// Adapted from dmmulroy/anti-slop
import type { ESTree, SourceCode } from "@oxlint/plugins";

import type { TypeAliasEnvironment } from "./type-alias-resolution.ts";

type Substitutions = ReadonlyMap<string, ESTree.TSType>;

type ResolvedType = {
  readonly type: ESTree.TSType;
  readonly substitutions: Substitutions;
};

type UnsafeValue = "any" | "empty-object" | "object" | "union" | "unknown";

type UnsafeDictionary = {
  readonly kind: "unsafe-dictionary";
  readonly unsafeValue: UnsafeValue;
};

type WideningTargetKind =
  | "anonymous object"
  | "generic container"
  | "object"
  | "open dictionary"
  | "unknown";

type WideningTarget = {
  readonly kind: WideningTargetKind;
};

type TypeEnvironment = {
  readonly interfaces: ReadonlyMap<string, readonly ESTree.TSInterfaceDeclaration[]>;
  readonly typeAliases: TypeAliasEnvironment;
};

const BUILT_INS = new Set([
  "Record",
  "Readonly",
  "Partial",
  "Required",
  "Pick",
  "Omit",
  "PropertyKey",
  "NonNullable",
]);

const TRANSPARENT_WRAPPERS = new Set(["Readonly", "Partial", "Required", "NonNullable"]);

function declaredStatement(statement: ESTree.Directive | ESTree.Statement): ESTree.Node | null {
  return statement.type === "ExportNamedDeclaration" ||
    statement.type === "ExportDefaultDeclaration"
    ? (statement.declaration ?? null)
    : statement;
}

function createTypeEnvironment(
  program: ESTree.Program,
  visitorKeys: SourceCode["visitorKeys"],
): TypeEnvironment {
  const interfaces = new Map<string, ESTree.TSInterfaceDeclaration[]>();

  for (const statement of program.body) {
    const declaration = declaredStatement(statement);

    if (declaration?.type !== "TSInterfaceDeclaration") {
      continue;
    }

    const declarations = interfaces.get(declaration.id.name) ?? [];
    declarations.push(declaration);
    interfaces.set(declaration.id.name, declarations);
  }

  return { interfaces, typeAliases: createTypeAliasEnvironment(program, visitorKeys) };
}

function typeReferenceName(type: ESTree.TSTypeReference): string | null {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}

function isBuiltIn(name: string, use: ESTree.Node, environment: TypeEnvironment): boolean {
  return BUILT_INS.has(name) && !hasVisibleTypeBinding(name, use, environment.typeAliases);
}

function unwrapTransparentType(type: ESTree.TSType): ESTree.TSType {
  let current = type;

  while (
    current.type === "TSParenthesizedType" ||
    (current.type === "TSTypeOperator" && current.operator === "readonly")
  ) {
    current = current.typeAnnotation;
  }

  return current;
}

function isUnappliedReferenceTo(type: ESTree.TSType, name: string): boolean {
  const unwrapped = unwrapTransparentType(type);

  return (
    unwrapped.type === "TSTypeReference" &&
    typeReferenceName(unwrapped) === name &&
    (unwrapped.typeArguments === null || unwrapped.typeArguments.params.length === 0)
  );
}

function isNeverType(type: ESTree.TSType): boolean {
  return unwrapTransparentType(type).type === "TSNeverKeyword";
}

function isEffectivelyEmptyMember(member: ESTree.TSSignature): boolean {
  return (
    member.type === "TSPropertySignature" &&
    member.optional &&
    member.typeAnnotation !== null &&
    isNeverType(member.typeAnnotation.typeAnnotation)
  );
}

function isEffectivelyEmptyTypeLiteral(type: ESTree.TSTypeLiteral): boolean {
  return type.members.length === 0 || type.members.every(isEffectivelyEmptyMember);
}

function isEffectivelyEmptyInterface(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
): boolean {
  if (declarations.length !== 1) {
    return false;
  }

  const [type] = declarations;

  return (
    type !== void 0 &&
    type.extends.length === 0 &&
    (type.body.body.length === 0 || type.body.body.every(isEffectivelyEmptyMember))
  );
}

function resolvedSubstitutionArgument(
  type: ESTree.TSType,
  base: Substitutions,
  resolving: ReadonlySet<string> = new Set<string>(),
): ESTree.TSType {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type !== "TSTypeReference") {
    return type;
  }

  const name = typeReferenceName(unwrapped);

  if (name === null || resolving.has(name)) {
    return type;
  }

  const substitution = base.get(name);

  if (substitution === void 0) {
    return type;
  }

  const nextResolving = new Set(resolving);
  nextResolving.add(name);

  return resolvedSubstitutionArgument(substitution, base, nextResolving);
}

function aliasSubstitution(
  alias: ESTree.TSTypeAliasDeclaration,
  type: ESTree.TSTypeReference,
  base: Substitutions,
): Substitutions | null {
  const parameters = alias.typeParameters?.params ?? [];
  const arguments_ = type.typeArguments?.params ?? [];
  const next = new Map<string, ESTree.TSType>(base);

  for (const [index, parameter] of parameters.entries()) {
    const argument = arguments_[index] ?? parameter.default;

    if (argument === null) {
      return null;
    }

    next.set(parameter.name.name, resolvedSubstitutionArgument(argument, next));
  }

  return next;
}

function unsafeDirectValue(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: Substitutions,
  resolvingAliases: ReadonlySet<string>,
): UnsafeValue | null {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type === "TSUnknownKeyword") {
    return "unknown";
  }

  if (unwrapped.type === "TSAnyKeyword") {
    return "any";
  }

  if (unwrapped.type === "TSObjectKeyword") {
    return "object";
  }

  if (unwrapped.type === "TSTypeLiteral" && isEffectivelyEmptyTypeLiteral(unwrapped)) {
    return "empty-object";
  }

  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some(
      (member) => unsafeDirectValue(member, environment, substitutions, resolvingAliases) !== null,
    )
      ? "union"
      : null;
  }

  if (unwrapped.type === "TSIntersectionType") {
    const unsafeMembers = unwrapped.types.map((member) =>
      unsafeDirectValue(member, environment, substitutions, resolvingAliases),
    );

    if (unsafeMembers.includes("any")) {
      return "any";
    }

    const [firstUnsafeMember] = unsafeMembers;

    return firstUnsafeMember !== undefined && unsafeMembers.every((member) => member !== null)
      ? firstUnsafeMember
      : null;
  }

  if (unwrapped.type !== "TSTypeReference") {
    return null;
  }

  const name = typeReferenceName(unwrapped);

  if (name === null) {
    return null;
  }

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, unwrapped, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];

    return wrapped === void 0
      ? null
      : unsafeDirectValue(wrapped, environment, substitutions, resolvingAliases);
  }

  const substitution = substitutions.get(name);

  if (substitution !== void 0) {
    return isUnappliedReferenceTo(substitution, name)
      ? null
      : unsafeDirectValue(substitution, environment, substitutions, resolvingAliases);
  }

  const interfaceDeclarations = environment.interfaces.get(name);

  if (interfaceDeclarations !== void 0) {
    return isEffectivelyEmptyInterface(interfaceDeclarations) ? "empty-object" : null;
  }

  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);

  if (alias === null || resolvingAliases.has(name)) {
    return null;
  }

  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);

  if (nextSubstitutions === null) {
    return null;
  }

  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);

  return unsafeDirectValue(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

function dictionaryValueTypes(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: Substitutions,
  resolvingAliases: ReadonlySet<string>,
): ResolvedType[] {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.flatMap((member) =>
      member.type === "TSIndexSignature"
        ? [{ type: member.typeAnnotation.typeAnnotation, substitutions }]
        : [],
    );
  }

  if (unwrapped.type === "TSMappedType") {
    return unwrapped.typeAnnotation === null
      ? []
      : [{ type: unwrapped.typeAnnotation, substitutions }];
  }

  if (unwrapped.type !== "TSTypeReference") {
    return [];
  }

  const name = typeReferenceName(unwrapped);

  if (name === null) {
    return [];
  }

  const substitution = substitutions.get(name);

  if (substitution !== void 0) {
    return isUnappliedReferenceTo(substitution, name)
      ? []
      : dictionaryValueTypes(substitution, environment, substitutions, resolvingAliases);
  }

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, unwrapped, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];

    return wrapped === void 0
      ? []
      : dictionaryValueTypes(wrapped, environment, substitutions, resolvingAliases);
  }

  if (name === "Record" && isBuiltIn(name, unwrapped, environment)) {
    const value = unwrapped.typeArguments?.params[1] ?? null;

    return value === null ? [] : [{ type: value, substitutions }];
  }

  if ((name === "Pick" || name === "Omit") && isBuiltIn(name, unwrapped, environment)) {
    const source = unwrapped.typeArguments?.params[0];

    return source === void 0
      ? []
      : dictionaryValueTypes(source, environment, substitutions, resolvingAliases);
  }

  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);

  if (alias === null || resolvingAliases.has(name)) {
    return [];
  }

  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);

  if (nextSubstitutions === null) {
    return [];
  }

  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);

  return dictionaryValueTypes(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}

function classifyUnsafeDictionaryValue(
  valueType: ESTree.TSType,
  environment: TypeEnvironment,
): UnsafeDictionary | null {
  const unsafeValue = unsafeDirectValue(
    valueType,
    environment,
    new Map<string, ESTree.TSType>(),
    new Set<string>(),
  );

  return unsafeValue === null ? null : { kind: "unsafe-dictionary", unsafeValue };
}

function classifyUnsafeDictionary(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): UnsafeDictionary | null {
  for (const valueType of dictionaryValueTypes(
    type,
    environment,
    new Map<string, ESTree.TSType>(),
    new Set<string>(),
  )) {
    const unsafeValue = unsafeDirectValue(
      valueType.type,
      environment,
      valueType.substitutions,
      new Set(),
    );

    if (unsafeValue !== null) {
      return { kind: "unsafe-dictionary", unsafeValue };
    }
  }

  return null;
}

function isBroadMappedKey(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: Substitutions,
  visitedAliases: ReadonlySet<string> = new Set<string>(),
): boolean {
  const unwrapped = unwrapTransparentType(type);

  if (
    unwrapped.type === "TSStringKeyword" ||
    unwrapped.type === "TSNumberKeyword" ||
    unwrapped.type === "TSSymbolKeyword"
  ) {
    return true;
  }

  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some((member) =>
      isBroadMappedKey(member, environment, substitutions, visitedAliases),
    );
  }

  if (unwrapped.type !== "TSTypeReference") {
    return false;
  }

  const name = typeReferenceName(unwrapped);

  if (name === null) {
    return false;
  }

  const substitution = substitutions.get(name);

  if (substitution !== void 0 && !isUnappliedReferenceTo(substitution, name)) {
    return isBroadMappedKey(substitution, environment, substitutions, visitedAliases);
  }

  if (name === "PropertyKey" && isBuiltIn(name, unwrapped, environment)) {
    return true;
  }

  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);

  if (
    alias === null ||
    (alias.typeParameters?.params.length ?? 0) > 0 ||
    visitedAliases.has(name)
  ) {
    return false;
  }

  const nextVisited = new Set(visitedAliases);
  nextVisited.add(name);

  return isBroadMappedKey(alias.typeAnnotation, environment, substitutions, nextVisited);
}

function hasBroadRecordKey(
  type: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  substitutions: Substitutions,
): boolean {
  const key = type.typeArguments?.params[0];

  return key === void 0 || isBroadMappedKey(key, environment, substitutions);
}

function classifyAliasBroadTarget(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: Substitutions,
  resolvingAliases: ReadonlySet<string>,
): WideningTarget | null {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type === "TSUnknownKeyword") {
    return { kind: "unknown" };
  }

  if (unwrapped.type === "TSObjectKeyword") {
    return { kind: "object" };
  }

  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.some((member) => member.type === "TSIndexSignature")
      ? { kind: "open dictionary" }
      : null;
  }

  if (unwrapped.type === "TSMappedType") {
    return isBroadMappedKey(unwrapped.constraint, environment, substitutions)
      ? { kind: "open dictionary" }
      : null;
  }

  if (unwrapped.type !== "TSTypeReference") {
    return null;
  }

  const name = typeReferenceName(unwrapped);

  if (name === null) {
    return null;
  }

  const substitution = substitutions.get(name);

  if (substitution !== void 0) {
    return isUnappliedReferenceTo(substitution, name)
      ? null
      : classifyAliasBroadTarget(substitution, environment, substitutions, resolvingAliases);
  }

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, unwrapped, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];

    return wrapped === void 0
      ? null
      : classifyAliasBroadTarget(wrapped, environment, substitutions, resolvingAliases);
  }

  if (name === "Record" && isBuiltIn(name, unwrapped, environment)) {
    return hasBroadRecordKey(unwrapped, environment, substitutions)
      ? { kind: "open dictionary" }
      : null;
  }

  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);

  if (alias === null || resolvingAliases.has(name)) {
    return null;
  }

  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);

  if (nextSubstitutions === null) {
    return null;
  }

  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);

  return classifyAliasBroadTarget(
    alias.typeAnnotation,
    environment,
    nextSubstitutions,
    nextResolving,
  );
}

function classifyWideningTarget(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): WideningTarget | null {
  const unwrapped = unwrapTransparentType(type);

  if (unwrapped.type === "TSUnknownKeyword") {
    return { kind: "unknown" };
  }

  if (unwrapped.type === "TSObjectKeyword") {
    return { kind: "object" };
  }

  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.some((member) => member.type === "TSIndexSignature")
      ? { kind: "open dictionary" }
      : unwrapped.members.length > 0
        ? { kind: "anonymous object" }
        : null;
  }

  if (unwrapped.type === "TSMappedType") {
    return { kind: "open dictionary" };
  }

  if (unwrapped.type !== "TSTypeReference") {
    return null;
  }

  const name = typeReferenceName(unwrapped);

  if (name === null) {
    return null;
  }

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, unwrapped, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];

    return wrapped === void 0 ? null : classifyWideningTarget(wrapped, environment);
  }

  if (name === "Record" && isBuiltIn(name, unwrapped, environment)) {
    return hasBroadRecordKey(unwrapped, environment, new Map<string, ESTree.TSType>())
      ? { kind: "open dictionary" }
      : null;
  }

  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);

  if (alias === null) {
    return null;
  }

  if ((alias.typeParameters?.params.length ?? 0) > 0) {
    const substitutions2 = aliasSubstitution(alias, unwrapped, new Map<string, ESTree.TSType>());

    const resolved2 =
      substitutions2 === null
        ? null
        : classifyAliasBroadTarget(
            alias.typeAnnotation,
            environment,
            substitutions2,
            new Set([name]),
          );

    return resolved2?.kind === "open dictionary" ? { kind: "generic container" } : null;
  }

  const substitutions = aliasSubstitution(alias, unwrapped, new Map<string, ESTree.TSType>());

  if (substitutions === null) {
    return null;
  }

  const resolved = classifyAliasBroadTarget(
    alias.typeAnnotation,
    environment,
    substitutions,
    new Set([name]),
  );

  return resolved;
}

function isPopulatedObjectExpression(expression: ESTree.Node): boolean {
  let current = expression;

  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSTypeAssertion" ||
    current.type === "TSNonNullExpression"
  ) {
    current = current.expression;
  }

  return current.type === "ObjectExpression" && current.properties.length > 0;
}

function isKnownEvidenceExpression(expression: ESTree.Node): boolean {
  let current = expression;

  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSTypeAssertion" ||
    current.type === "TSNonNullExpression" ||
    current.type === "TSSatisfiesExpression"
  ) {
    current = current.expression;
  }

  if (current.type === "ObjectExpression") {
    return true;
  }

  return (
    current.type === "ArrayExpression" ||
    current.type === "ArrowFunctionExpression" ||
    current.type === "ClassExpression" ||
    current.type === "FunctionExpression" ||
    current.type === "NewExpression" ||
    current.type === "Literal" ||
    current.type === "TemplateLiteral" ||
    current.type === "UnaryExpression"
  );
}

export type { TypeEnvironment, UnsafeDictionary, WideningTarget };

export {
  classifyUnsafeDictionary,
  classifyUnsafeDictionaryValue,
  classifyWideningTarget,
  createTypeEnvironment,
  isKnownEvidenceExpression,
  isPopulatedObjectExpression,
};
