import { extname } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultIgnores } from "../ignores.ts";

import type {
  DummyRule,
  DummyRuleMap,
  ExternalPluginEntry,
  OxlintConfig,
  OxlintEnv,
  OxlintOverride,
} from "oxlint";

export type FileScope = true | string[];

export type AppRoots = true | string[];

export type OneOrMore<Item> = [Item, ...Item[]];

export interface ImportBoundary {
  files: string[];
  ignore?: string[];
  deny: string[];
  message: string;
  types?: boolean;
}

export type LintPlugin = NonNullable<OxlintConfig["plugins"]>[number];

export type JsPlugin = Exclude<ExternalPluginEntry, string>;

interface LayerSettings {
  plugins?: LintPlugin[];
  jsPlugins?: JsPlugin[];
  env?: OxlintEnv;
  rules: DummyRuleMap;
  boundaries?: never;
}

export type ScopedLayer = LayerSettings & { files: string[]; excludeFiles?: string[] };

export type GlobalLayer = LayerSettings & { files?: never; excludeFiles?: never };

export type BoundaryLayer = { boundaries: ImportBoundary[] } & {
  [Setting in keyof ScopedLayer as Exclude<Setting, "boundaries">]?: never;
};

export type LintLayer = ScopedLayer | GlobalLayer | BoundaryLayer;

type RuleLayer = ScopedLayer | GlobalLayer;

export interface LintScope {
  typeAware: boolean;
  source: string[];
  typeScript: string[];
  javaScript: string[];
  tests: string[];
  endToEnd: string[];
  testSupport: string[];
  entrypoints: string[];
  programs: string[];
}

export type BaseProfile = (scope: LintScope) => LintLayer[];

export interface Profile<Option> {
  (scope: LintScope, option: Option): LintLayer[];
  testFiles?: (option: Option) => string[];
}

export type StandardLintOptions = Pick<OxlintConfig, "rules" | "overrides" | "ignorePatterns"> & {
  root?: string;
  typeAware?: boolean;
  tests?: string[];
};

type ProfileOptions<Options> = { [Name in keyof Options]?: Options[Name] | false };

type Profiles<Options> = { [Name in keyof Options]: Profile<Options[Name]> };

export type LintOptions<Options> = StandardLintOptions & ProfileOptions<Options>;

export interface LintPresetDefinition<Options> {
  base: BaseProfile[];
  profiles: Profiles<Options> & { [Name in keyof StandardLintOptions]?: never };
  rules?: DummyRuleMap;
  ignorePatterns?: string[];
}

export type SharedLintConfig = OxlintConfig & {
  ignorePatterns: string[];
  overrides: OxlintOverride[];
  rules: DummyRuleMap;
};

const basePlugins: LintPlugin[] = ["eslint", "unicorn", "oxc", "import", "promise", "typescript"];

const wysePlugin: JsPlugin = {
  name: "wyse",
  specifier: fileURLToPath(new URL(`../index${extname(import.meta.url)}`, import.meta.url)),
};

const sourceFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

const testFiles = [
  "**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "**/__tests__/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
];

const fileScopes = {
  source: sourceFiles,
  typeScript: ["**/*.{ts,tsx,mts,cts}"],
  javaScript: ["**/*.{js,jsx,mjs,cjs}"],
  endToEnd: [
    "**/e2e/**",
    "**/*.e2e.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
    "**/*.e2e.{test,spec}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  ],
  testSupport: [
    "**/*.{fixture,test-utils}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
    "**/{test,tests}/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  ],
  entrypoints: [
    "**/*.{config,conf}.{js,mjs,cjs,ts,mts,cts}",
    "**/{sanity.cli,codegen,graphql-codegen}.{js,mjs,cjs,ts,mts,cts}",
    "**/scripts/**/*.{js,mjs,cjs,ts,mts,cts}",
  ],
  programs: [
    "**/{bin,cli,deploy,tools,test,tests,e2e,fixtures}/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
    "**/.storybook/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
    "**/{main,server,worker,instrumentation,instrumentation-client,healthcheck}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  ],
};

export function errorRules(plugin: string, names: string[]): DummyRuleMap {
  return Object.fromEntries(names.map((name) => [`${plugin}/${name}`, "error"]));
}

export function filesFor(option: FileScope, fallback: string[]): string[] {
  return option === true ? fallback : option;
}

export function appPrefixes(roots: AppRoots): string[] {
  return filesFor(roots, ["."]).map((root) => {
    const normalized = root.replace(/^\.\//, "").replace(/\/+$/, "");

    return normalized === "." || normalized === "" ? "" : `${normalized}/`;
  });
}

export function appFiles(scope: LintScope, roots: AppRoots): string[] {
  return appPrefixes(roots).flatMap((prefix) => scope.source.map((files) => `${prefix}${files}`));
}

export function extendProfile<Option>(
  profile: Profile<Option>,
  extension: (scope: LintScope, option: Option) => LintLayer[],
): Profile<Option> {
  const extended: Profile<Option> = (scope, option) => [
    ...profile(scope, option),
    ...extension(scope, option),
  ];

  if (profile.testFiles) {
    extended.testFiles = profile.testFiles;
  }

  return extended;
}

interface SelectedProfile {
  testFiles: string[];
  layers: BaseProfile;
}

function selectProfile<Option>(profile: Profile<Option>, option: Option | false | undefined) {
  if (option === undefined || option === false || (Array.isArray(option) && option.length === 0)) {
    return [];
  }

  return [
    {
      testFiles: profile.testFiles?.(option) ?? [],
      layers: (scope) => profile(scope, option),
    },
  ] satisfies SelectedProfile[];
}

function severity(rule: DummyRule) {
  return Array.isArray(rule) ? rule[0] : rule;
}

function isEnabled(rule: DummyRule | undefined): rule is DummyRule {
  return rule !== undefined && !["off", "allow", 0].includes(severity(rule));
}

function changedRule({ current, change }: { current: DummyRule; change: DummyRule }) {
  const keepsOptions = isEnabled(change) && (!Array.isArray(change) || change.length === 1);

  return keepsOptions && Array.isArray(current)
    ? ([severity(change), ...current.slice(1)] satisfies DummyRule)
    : change;
}

function combinedChanges({ preset, project }: { preset: DummyRuleMap; project: DummyRuleMap }) {
  const combined: DummyRuleMap = { ...preset };

  for (const [name, change] of Object.entries(project)) {
    const current = preset[name];

    if (change !== undefined) {
      combined[name] = current === undefined ? change : changedRule({ current, change });
    }
  }

  return combined;
}

function rulePlugin(name: string) {
  const separator = name.lastIndexOf("/");

  return separator === -1 ? "eslint" : name.slice(0, separator);
}

function pluginNames(layer: RuleLayer) {
  return [...(layer.plugins ?? []), ...(layer.jsPlugins ?? []).map((plugin) => plugin.name)];
}

function adjustRules(layers: RuleLayer[], changes: DummyRuleMap) {
  const settings = layers.flatMap((layer) => Object.entries(layer.rules));
  const set = new Set(settings.map(([name]) => name));
  const enabled = new Set(settings.flatMap(([name, rule]) => (isEnabled(rule) ? [name] : [])));

  const rootPlugins = new Set<string>([
    wysePlugin.name,
    ...basePlugins,
    ...layers.flatMap((layer) => (layer.files ? [] : pluginNames(layer))),
  ]);

  const scopedPlugins = new Set(layers.flatMap((layer) => (layer.files ? pluginNames(layer) : [])));
  const unset = Object.entries(changes).filter(([name]) => !set.has(name));
  const scopedChanges = unset.filter(([name]) => !rootPlugins.has(rulePlugin(name)));

  const adjusted = layers.map((layer) => {
    const layerPlugins = new Set(layer.files ? pluginNames(layer) : []);

    return {
      ...layer,
      rules: {
        ...Object.fromEntries(
          Object.entries(layer.rules).map(([name, current]) => {
            const change = changes[name];

            if (change === undefined || current === undefined) {
              return [name, current];
            }

            const applies = isEnabled(current) || !enabled.has(name);

            return [name, applies ? changedRule({ current, change }) : current];
          }),
        ),
        ...Object.fromEntries(scopedChanges.filter(([name]) => layerPlugins.has(rulePlugin(name)))),
      },
    };
  });

  const added = Object.fromEntries(
    unset.filter(([name, change]) => {
      const plugin = rulePlugin(name);

      return rootPlugins.has(plugin) || (isEnabled(change) && !scopedPlugins.has(plugin));
    }),
  );

  return Object.keys(added).length > 0 ? [...adjusted, { rules: added }] : adjusted;
}

function withBasePlugins(override: OxlintOverride) {
  return override.plugins
    ? { ...override, plugins: [...new Set([...basePlugins, ...override.plugins])] }
    : override;
}

function scopedOverride(layer: ScopedLayer) {
  const override: OxlintOverride = { files: layer.files, rules: layer.rules };

  if (layer.excludeFiles) {
    override.excludeFiles = layer.excludeFiles;
  }

  if (layer.plugins) {
    override.plugins = [...basePlugins, ...layer.plugins];
  }

  if (layer.env) {
    override.env = layer.env;
  }

  return override;
}

interface Composition {
  layers: RuleLayer[];
  typeAware: boolean;
  ignorePatterns: string[];
  overrides: OxlintOverride[];
}

function composeConfig({ layers, typeAware, ignorePatterns, overrides }: Composition) {
  const plugins = new Set(basePlugins);
  const env: OxlintEnv = { es2022: true };
  const rules: DummyRuleMap = {};
  const scoped: OxlintOverride[] = [];
  const scopedRules = new Set<string>();

  for (const layer of layers) {
    if (layer.files) {
      scoped.push(scopedOverride(layer));
      Object.keys(layer.rules).forEach((name) => scopedRules.add(name));
    } else {
      const afterScoped = Object.fromEntries(
        Object.entries(layer.rules).filter(([name]) => scopedRules.has(name)),
      );

      Object.assign(rules, layer.rules);
      Object.assign(env, layer.env);
      layer.plugins?.forEach((plugin) => plugins.add(plugin));

      if (Object.keys(afterScoped).length > 0) {
        scoped.push({ files: ["**/*"], rules: afterScoped });
      }
    }
  }

  const jsPlugins = [wysePlugin, ...layers.flatMap((layer) => layer.jsPlugins ?? [])];

  return {
    categories: { correctness: "error", suspicious: "error" },
    options: { reportUnusedDisableDirectives: "error", typeAware },
    plugins: [...plugins],
    jsPlugins: [...new Map(jsPlugins.map((plugin) => [plugin.name, plugin])).values()],
    env,
    ignorePatterns,
    rules,
    overrides: [...scoped, ...overrides.map(withBasePlugins)],
  } satisfies SharedLintConfig;
}

function ruleLayers(layers: LintLayer[], scope: LintScope, root: string | undefined) {
  const boundaries: ImportBoundary[] = [];
  const result: RuleLayer[] = [];

  for (const layer of layers) {
    if (!("boundaries" in layer)) {
      result.push(layer);
    } else if (layer.boundaries.length > 0) {
      if (root === undefined) {
        throw new TypeError(
          "Import boundaries resolve from the config file, so pass root: import.meta.dirname.",
        );
      }

      boundaries.push(...layer.boundaries);
      result.push({
        files: scope.source,
        rules: { "wyse/import-boundaries": ["error", { root, boundaries: [...boundaries] }] },
      });
    }
  }

  return result;
}

export function defineLintPreset<Options>(
  definition: LintPresetDefinition<Options>,
): (options?: LintOptions<Options>) => SharedLintConfig {
  return (options = {}) => {
    const profiles: Profiles<Options> = definition.profiles;
    const profileOptions: ProfileOptions<Options> = options;
    const selected: SelectedProfile[] = [];

    for (const name in profiles) {
      selected.push(...selectProfile(profiles[name], profileOptions[name]));
    }

    const scope: LintScope = {
      ...fileScopes,
      typeAware: options.typeAware ?? true,
      tests: [
        ...new Set([
          ...testFiles,
          ...(options.tests ?? []),
          ...selected.flatMap((profile) => profile.testFiles),
        ]),
      ],
    };

    const layers = [
      ...definition.base.flatMap((profile) => profile(scope)),
      ...selected.flatMap((profile) => profile.layers(scope)),
    ];

    return composeConfig({
      layers: adjustRules(
        ruleLayers(layers, scope, options.root),
        combinedChanges({ preset: definition.rules ?? {}, project: options.rules ?? {} }),
      ),
      typeAware: scope.typeAware,
      ignorePatterns: [
        ...defaultIgnores,
        ...(definition.ignorePatterns ?? []),
        ...(options.ignorePatterns ?? []),
      ],
      overrides: options.overrides ?? [],
    });
  };
}
