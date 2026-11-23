import { basename } from "node:path";

import {
  constantString,
  moduleExportName,
  propertyName,
  unwrapExpression,
  variableFor,
  importedBinding,
  isFunctionNode,
  isGlobal,
  ownReturns,
} from "./index.ts";
import { resolveProperty, valueBranches } from "./object-properties.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

export type ConfigLayer = ESTree.Node | "unknown";

export type ConfigLayers = readonly ConfigLayer[];

export type ConfigMerge = "deep" | "spread";

export type ConfigRunner = "vitest" | "playwright";

type ProjectName = { readonly known: string | undefined } | "unknown";

type Project = { readonly name: ProjectName; readonly layers: ConfigLayers };

const configFactories = new Set([
  "defineConfig",
  "defineProject",
  "defineWorkspace",
  "mergeConfig",
]);

const viteModules = new Set(["vitest/config", "vite", "vitest", "vite-plus"]);

const configModules = new Set([...viteModules, "@playwright/test"]);

const unknownLayers: ConfigLayer[][] = [["unknown"]];

const vitestConfigFile =
  /^(?:vitest(?:\..+)?\.config|vite\.config|vitest\.workspace)\.(?:[cm]?[jt]s|[jt]sx)$/u;

const playwrightConfigFile = /^playwright(?:\..+)?\.config\.(?:[cm]?[jt]s|[jt]sx)$/u;

export function configFileRunner(filename: string): ConfigRunner | null {
  const name = basename(filename);

  if (vitestConfigFile.test(name)) {
    return "vitest";
  }

  return playwrightConfigFile.test(name) ? "playwright" : null;
}

function propertyLayers(sourceCode: SourceCode, layers: ConfigLayers, name: string) {
  return layers.flatMap<ConfigLayer>((layer) => {
    if (layer === "unknown") {
      return [layer];
    }

    const property = resolveProperty(sourceCode, layer, name);

    if (property.kind === "known") {
      return [property.value];
    }

    return property.kind === "unknown" ? ["unknown"] : [];
  });
}

export function finalValue(
  sourceCode: SourceCode,
  layers: ConfigLayers,
  name: string,
  merge: ConfigMerge,
): ESTree.Node | null {
  const resolved = layers.map((layer) =>
    layer === "unknown" ? { kind: "unknown" as const } : resolveProperty(sourceCode, layer, name),
  );

  const winner = resolved.findLast(
    (property) =>
      property.kind !== "missing" && (merge === "spread" || property.kind !== "undefined"),
  );

  return winner?.kind === "known" ? winner.value : null;
}

const arrayEntries: (
  sourceCode: SourceCode,
  node: ESTree.Node,
  expanded: ReadonlySet<ESTree.Node>,
) => ConfigLayer[] = (sourceCode, node, expanded) => {
  const [array, ...others] = valueBranches(sourceCode, node);

  if (array?.type !== "ArrayExpression" || others.length > 0 || expanded.has(array)) {
    return ["unknown"];
  }

  const next = new Set([...expanded, array]);

  return array.elements.flatMap((element) => {
    if (element === null) {
      return [];
    }

    return element.type === "SpreadElement"
      ? arrayEntries(sourceCode, element.argument, next)
      : [element];
  });
};

function configFactory(sourceCode: SourceCode, callee: ESTree.Expression) {
  const binding = importedBinding(sourceCode, callee);

  if (binding !== null && configModules.has(binding.source) && configFactories.has(binding.name)) {
    return { name: binding.name, source: binding.source };
  }

  const value = unwrapExpression(callee);
  const name = value.type === "Identifier" ? value.name : propertyName(value);

  return name !== null && configFactories.has(name) ? { name, source: null } : null;
}

function configArguments(sourceCode: SourceCode, call: ESTree.CallExpression) {
  const factory = configFactory(sourceCode, call.callee);

  if (factory === null) {
    return null;
  }

  if (factory.name === "mergeConfig") {
    return call.arguments.slice(0, 2);
  }

  return factory.source !== null && viteModules.has(factory.source)
    ? call.arguments.slice(0, 1)
    : call.arguments;
}

function boundFunction(sourceCode: SourceCode, node: ESTree.Node) {
  const definition = variableFor(sourceCode, node)?.defs[0];

  return definition?.type === "FunctionName" && isFunctionNode(definition.node)
    ? definition.node
    : null;
}

const configAlternatives: (
  sourceCode: SourceCode,
  node: ESTree.Node,
  expanded: ReadonlySet<ESTree.Node>,
) => ConfigLayer[][] = (sourceCode, node, expanded) =>
  valueBranches(sourceCode, node).flatMap((value) => {
    const fn = isFunctionNode(value) ? value : boundFunction(sourceCode, value);
    const source = fn ?? value;

    if (expanded.has(source)) {
      return unknownLayers;
    }

    const next = new Set([...expanded, source]);

    if (fn !== null) {
      return ownReturns(fn, sourceCode.visitorKeys).flatMap((returned) =>
        configAlternatives(sourceCode, returned, next),
      );
    }

    const configs = value.type === "CallExpression" ? configArguments(sourceCode, value) : null;

    if (configs === null) {
      return [[value]];
    }

    const [only, ...others] = configs;

    if (only !== undefined && only.type !== "SpreadElement" && others.length === 0) {
      return configAlternatives(sourceCode, only, next);
    }

    return [
      configs.flatMap((argument) => {
        const alternatives =
          argument.type === "SpreadElement" ? [] : configAlternatives(sourceCode, argument, next);

        const [alternative, ...otherAlternatives] = alternatives;

        return alternative !== undefined && otherAlternatives.length === 0
          ? alternative
          : ["unknown" as const];
      }),
    ];
  });

function projectAlternatives(sourceCode: SourceCode, projects: ConfigLayers) {
  return projects.flatMap((project) =>
    project === "unknown"
      ? []
      : arrayEntries(sourceCode, project, new Set()).flatMap((entry) =>
          entry === "unknown" ? [] : configAlternatives(sourceCode, entry, new Set()),
        ),
  );
}

function unvisitedLayers(layers: ConfigLayers, inspected: Set<ESTree.Node>) {
  return layers.flatMap((layer) => {
    if (layer === "unknown" || inspected.has(layer)) {
      return [];
    }

    inspected.add(layer);

    return [layer];
  });
}

function workspaceArray(layers: ConfigLayers) {
  const [only, ...others] = layers;

  return only !== undefined &&
    only !== "unknown" &&
    only.type === "ArrayExpression" &&
    others.length === 0
    ? only
    : null;
}

export function vitestRootTestValue(
  sourceCode: SourceCode,
  layers: ConfigLayers,
  name: string,
): ESTree.Node | null {
  return workspaceArray(layers) === null
    ? finalValue(sourceCode, propertyLayers(sourceCode, layers, "test"), name, "deep")
    : null;
}

export function vitestProjects(
  sourceCode: SourceCode,
  layers: ConfigLayers,
  inspected: Set<ESTree.Node>,
): ConfigLayer[][] {
  const workspace = workspaceArray(layers);

  const projects =
    workspace === null
      ? unvisitedLayers(layers, inspected).flatMap((layer) =>
          propertyLayers(sourceCode, propertyLayers(sourceCode, [layer], "test"), "projects"),
        )
      : unvisitedLayers([workspace], inspected);

  return projectAlternatives(sourceCode, projects);
}

function projectName(sourceCode: SourceCode, entry: ConfigLayer) {
  if (entry === "unknown") {
    return "unknown" as const;
  }

  const name = resolveProperty(sourceCode, entry, "name");

  if (name.kind === "missing" || name.kind === "undefined") {
    return { known: undefined };
  }

  const text = name.kind === "known" ? constantString(sourceCode, name.value) : null;

  return text === null ? ("unknown" as const) : { known: text };
}

function nameMatch(first: ProjectName, second: ProjectName) {
  if (first === "unknown" || second === "unknown") {
    return "maybe";
  }

  return first.known === second.known ? "same" : "different";
}

function layerProjects(sourceCode: SourceCode, layer: ConfigLayer) {
  const projects = layer === "unknown" ? null : resolveProperty(sourceCode, layer, "projects");

  if (projects?.kind === "known") {
    return arrayEntries(sourceCode, projects.value, new Set());
  }

  return projects === null || projects.kind === "unknown" ? ["unknown" as const] : [];
}

function clearsProjects(sourceCode: SourceCode, layer: ConfigLayer) {
  return layer !== "unknown" && resolveProperty(sourceCode, layer, "projects").kind === "undefined";
}

export function playwrightProjects(sourceCode: SourceCode, layers: ConfigLayers): ConfigLayers[] {
  return layers
    .reduce<Project[]>((projects, layer) => {
      if (clearsProjects(sourceCode, layer)) {
        return [];
      }

      const overrides = layerProjects(sourceCode, layer).map((entry) => ({
        name: projectName(sourceCode, entry),
        layers: [entry],
      }));

      const merged = projects.map((project) => {
        const matches = overrides.map((override) => nameMatch(project.name, override.name));
        const override = overrides.findLast((_, index) => matches[index] === "same");

        if (matches.includes("maybe")) {
          return { ...project, layers: [...project.layers, "unknown" as const] };
        }

        return override === undefined
          ? project
          : { ...project, layers: [...project.layers, ...override.layers] };
      });

      const added = overrides.filter((override) =>
        projects.every((project) => nameMatch(project.name, override.name) !== "same"),
      );

      return [...merged, ...added];
    }, [])
    .map((project) => project.layers);
}

function isModuleExports(sourceCode: SourceCode, node: ESTree.Node) {
  return (
    node.type === "MemberExpression" &&
    propertyName(node) === "exports" &&
    isGlobal(sourceCode, node.object, "module")
  );
}

export function configExportVisitors(
  sourceCode: SourceCode,
  onConfig: (layers: ConfigLayers) => void,
) {
  const read = (node: ESTree.Node) => {
    configAlternatives(sourceCode, node, new Set()).forEach(onConfig);
  };

  return {
    AssignmentExpression(node: ESTree.AssignmentExpression) {
      if (isModuleExports(sourceCode, node.left)) {
        read(node.right);
      }
    },
    ExportDefaultDeclaration(node: ESTree.ExportDefaultDeclaration) {
      read(node.declaration);
    },
    ExportNamedDeclaration(node: ESTree.ExportNamedDeclaration) {
      if (node.source === null) {
        node.specifiers
          .filter((specifier) => moduleExportName(specifier.exported) === "default")
          .forEach((specifier) => {
            read(specifier.local);
          });
      }
    },
  };
}
