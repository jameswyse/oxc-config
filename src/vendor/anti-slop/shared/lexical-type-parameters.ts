import { childNodes } from "../../../shared/index.ts";

// Adapted from dmmulroy/anti-slop
import type { ESTree, SourceCode } from "@oxlint/plugins";

type VisitorKeys = SourceCode["visitorKeys"];

function collectInferTypeParameterNames(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
  names: Set<string>,
): void {
  if (node.type === "TSInferType") {
    names.add(node.typeParameter.name.name);
  }

  for (const child of childNodes(node, visitorKeys)) {
    collectInferTypeParameterNames(child, visitorKeys, names);
  }
}

function lexicalTypeParameterNames(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
): ReadonlySet<string> {
  const names = new Set<string>();
  let descendant: ESTree.Node = node;
  let current: ESTree.Node = node;

  while (current.type !== "Program") {
    if ("typeParameters" in current) {
      for (const parameter of current.typeParameters?.params ?? []) {
        names.add(parameter.name.name);
      }
    }

    if (
      current.type === "TSMappedType" &&
      (descendant === current.nameType || descendant === current.typeAnnotation)
    ) {
      names.add(current.key.name);
    }

    if (current.type === "TSConditionalType" && descendant === current.trueType) {
      collectInferTypeParameterNames(current.extendsType, visitorKeys, names);
    }

    descendant = current;
    current = current.parent;
  }

  return names;
}

export { lexicalTypeParameterNames };
