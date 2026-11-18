import { basename } from "node:path";

import { defineRule } from "@oxlint/plugins";

import {
  constantString,
  moduleExportName,
  propertyName,
  unwrapExpression,
  variableFor,
  testRegistration,
  isTestRunner,
  isImportedTestDescribeConfigure,
  importedBinding,
  isFunctionNode,
  isGlobal,
  ownReturns,
} from "../shared/index.ts";
import { resolveProperty, valueBranches } from "../shared/object-properties.ts";

import type { ESTree, SourceCode } from "@oxlint/plugins";

type Layer = ESTree.Node | "unknown";

type Merge = "deep" | "spread";

type ProjectName = { readonly known: string | undefined } | "unknown";

type Project = { readonly name: ProjectName; readonly layers: readonly Layer[] };

type ConfigRetries = (
  sourceCode: SourceCode,
  layers: readonly Layer[],
  inspected: Set<ESTree.Node>,
) => ESTree.Node[];

const registrationKeys = ["retry", "retries"];

const configFactories = new Set([
  "defineConfig",
  "defineProject",
  "defineWorkspace",
  "mergeConfig",
]);

const viteModules = new Set(["vitest/config", "vite", "vitest"]);

const configModules = new Set([...viteModules, "@playwright/test"]);

const unknownLayers: Layer[][] = [["unknown"]];

const vitestConfigFile =
  /^(?:vitest(?:\..+)?\.config|vite\.config|vitest\.workspace)\.(?:[cm]?[jt]s|[jt]sx)$/u;

const playwrightConfigFile = /^playwright(?:\..+)?\.config\.(?:[cm]?[jt]s|[jt]sx)$/u;

function isZero(node: ESTree.Node) {
  const value = unwrapExpression(node);

  return value.type === "Literal" && value.value === 0;
}

function propertyLayers(sourceCode: SourceCode, layers: readonly Layer[], name: string) {
  return layers.flatMap<Layer>((layer) => {
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

function layeredValue(
  sourceCode: SourceCode,
  layers: readonly Layer[],
  name: string,
  merge: Merge,
) {
  const resolved = layers.map((layer) =>
    layer === "unknown" ? { kind: "unknown" as const } : resolveProperty(sourceCode, layer, name),
  );

  const winner = resolved.findLast(
    (property) =>
      property.kind !== "missing" && (merge === "spread" || property.kind !== "undefined"),
  );

  return winner?.kind === "known" ? winner.value : null;
}

function retryValue(sourceCode: SourceCode, layers: readonly Layer[], name: string, merge: Merge) {
  const value = layeredValue(sourceCode, layers, name, merge);

  return value === null || isZero(value) ? null : value;
}

function hasRetry(sourceCode: SourceCode, node: ESTree.Node | undefined, names: readonly string[]) {
  return (
    node !== undefined &&
    names.some((name) => retryValue(sourceCode, [node], name, "spread") !== null)
  );
}

function testRetry(sourceCode: SourceCode, node: ESTree.CallExpression) {
  const registration = testRegistration(sourceCode, node);

  if (registration !== null) {
    return registration.options.some((argument) =>
      hasRetry(sourceCode, argument, registrationKeys),
    );
  }

  const callee = node.callee;

  if (callee.type !== "MemberExpression") {
    return false;
  }

  const method = propertyName(callee);
  const [first] = node.arguments;

  if (method === "setConfig") {
    return (
      isTestRunner(sourceCode, callee.object, "vi", ["vitest", "@effect/vitest"]) &&
      hasRetry(sourceCode, first, ["retry"])
    );
  }

  if (method === "retryTimes") {
    return (
      isTestRunner(sourceCode, callee.object, "jest", ["@jest/globals"]) &&
      !(first !== undefined && isZero(first))
    );
  }

  return (
    isImportedTestDescribeConfigure(sourceCode, callee) && hasRetry(sourceCode, first, ["retries"])
  );
}

const arrayEntries: (
  sourceCode: SourceCode,
  node: ESTree.Node,
  expanded: ReadonlySet<ESTree.Node>,
) => Layer[] = (sourceCode, node, expanded) => {
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
) => Layer[][] = (sourceCode, node, expanded) =>
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

function projectAlternatives(sourceCode: SourceCode, projects: readonly Layer[]) {
  return projects.flatMap((project) =>
    project === "unknown"
      ? []
      : arrayEntries(sourceCode, project, new Set()).flatMap((entry) =>
          entry === "unknown" ? [] : configAlternatives(sourceCode, entry, new Set()),
        ),
  );
}

function unvisitedLayers(layers: readonly Layer[], inspected: Set<ESTree.Node>) {
  return layers.flatMap((layer) => {
    if (layer === "unknown" || inspected.has(layer)) {
      return [];
    }

    inspected.add(layer);

    return [layer];
  });
}

function workspaceArray(layers: readonly Layer[]) {
  const [only, ...others] = layers;

  return only !== undefined &&
    only !== "unknown" &&
    only.type === "ArrayExpression" &&
    others.length === 0
    ? only
    : null;
}

const vitestRetries: ConfigRetries = (sourceCode, layers, inspected) => {
  const workspace = workspaceArray(layers);

  const retry =
    workspace === null
      ? retryValue(sourceCode, propertyLayers(sourceCode, layers, "test"), "retry", "deep")
      : null;

  const projects =
    workspace === null
      ? unvisitedLayers(layers, inspected).flatMap((layer) =>
          propertyLayers(sourceCode, propertyLayers(sourceCode, [layer], "test"), "projects"),
        )
      : unvisitedLayers([workspace], inspected);

  return [
    ...(retry === null ? [] : [retry]),
    ...projectAlternatives(sourceCode, projects).flatMap((alternative) =>
      vitestRetries(sourceCode, alternative, inspected),
    ),
  ];
};

function projectName(sourceCode: SourceCode, entry: Layer) {
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

function layerProjects(sourceCode: SourceCode, layer: Layer) {
  const projects = layer === "unknown" ? null : resolveProperty(sourceCode, layer, "projects");

  if (projects?.kind === "known") {
    return arrayEntries(sourceCode, projects.value, new Set());
  }

  return projects === null || projects.kind === "unknown" ? ["unknown" as const] : [];
}

function mergedProjects(sourceCode: SourceCode, layers: readonly Layer[]) {
  return layers.reduce<Project[]>((projects, layer) => {
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
  }, []);
}

const playwrightRetries: ConfigRetries = (sourceCode, layers) =>
  [layers, ...mergedProjects(sourceCode, layers).map((project) => project.layers)].flatMap(
    (alternative) => retryValue(sourceCode, alternative, "retries", "spread") ?? [],
  );

function configRetries(filename: string) {
  const name = basename(filename);

  if (vitestConfigFile.test(name)) {
    return vitestRetries;
  }

  return playwrightConfigFile.test(name) ? playwrightRetries : null;
}

function isModuleExports(sourceCode: SourceCode, node: ESTree.Node) {
  return (
    node.type === "MemberExpression" &&
    propertyName(node) === "exports" &&
    isGlobal(sourceCode, node.object, "module")
  );
}

export const noTestRetries = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Fix flaky tests instead of retrying them." },
    schema: [],
    messages: {
      retry:
        "A test that passes on rerun is a flaky test. Fix the cause instead of retrying it, for example by awaiting the event the test depends on.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const retries = configRetries(context.filename);
    const reported = new Set<ESTree.Node>();

    const inspected = new Set<ESTree.Node>();

    const report = (node: ESTree.Node) => {
      if (!reported.has(node)) {
        reported.add(node);
        context.report({ node, messageId: "retry" });
      }
    };

    const reportConfig = (node: ESTree.Node) => {
      if (retries !== null) {
        configAlternatives(sourceCode, node, new Set()).forEach((layers) =>
          retries(sourceCode, layers, inspected).forEach(report),
        );
      }
    };

    return {
      CallExpression(node) {
        if (testRetry(sourceCode, node)) {
          report(node);
        }
      },
      AssignmentExpression(node) {
        if (isModuleExports(sourceCode, node.left)) {
          reportConfig(node.right);
        }
      },
      ExportDefaultDeclaration(node) {
        reportConfig(node.declaration);
      },
      ExportNamedDeclaration(node) {
        if (node.source === null) {
          node.specifiers
            .filter((specifier) => moduleExportName(specifier.exported) === "default")
            .forEach((specifier) => reportConfig(specifier.local));
        }
      },
    };
  },
});
