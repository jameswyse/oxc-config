import { createRequire } from "node:module";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

import type { DummyRuleMap, ExternalPluginEntry, OxlintConfig, OxlintOverride } from "oxlint";

export type FileScope = boolean | string[];

export interface LintOptions {
  typeAware?: boolean;
  node?: FileScope;
  react?: FileScope;
  nextjs?: FileScope;
  vitest?: FileScope;
  jest?: FileScope;
  effect?: FileScope;
  tests?: string[];
  env?: [string, ...string[]];
  boundaries?: ImportBoundary[];
  serverActionGuards?: [string, ...string[]];
  clock?: [string, ...string[]];
  random?: [string, ...string[]];
  electron?: boolean | { renderer?: string[] };
}

export interface ImportBoundary {
  files: string[];
  ignore?: string[];
  deny: string[];
  message: string;
}

export type SharedLintConfig = OxlintConfig & {
  ignorePatterns: string[];
  overrides: OxlintOverride[];
  rules: DummyRuleMap;
};

type LintPlugin = NonNullable<OxlintConfig["plugins"]>[number];

const require = createRequire(import.meta.url);

const sourceFiles = ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

const typeScriptFiles = ["**/*.{ts,tsx,mts,cts}"];

const testFiles = [
  "**/*.{test,spec}.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
  "**/__tests__/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
];

export const defaultIgnores: string[] = [
  "**/node_modules/**",
  "**/coverage/**",
  "**/dist/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.output/**",
  "**/.turbo/**",
  "**/playwright-report/**",
  "**/test-results/**",
  "**/.agent/**",
  "**/.claude/**",
  "**/.codex/**",
  "**/.cursor/**",
  "**/.gemini/**",
  "**/.playwright-cli/**",
];

const entrypointFiles = [
  "**/*.{config,conf}.{js,mjs,cjs,ts,mts,cts}",
  "**/{sanity.cli,codegen,graphql-codegen}.{js,mjs,cjs,ts,mts,cts}",
  "**/scripts/**/*.{js,mjs,cjs,ts,mts,cts}",
];

const defaultExportFiles = [
  "**/*.d.{ts,mts,cts}",
  "**/*.stories.{js,jsx,mjs,ts,tsx,mts}",
  "**/.storybook/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}",
];

const endToEndFiles = ["**/e2e/**", "**/*.e2e.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

const electronRendererFiles = ["src/renderer/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

const testRules: DummyRuleMap = {
  "wyse/no-fixed-test-delay": "error",
  "wyse/no-vacuous-test-assertions": "error",
  "wyse/no-edit-proof-assertions": "error",
  "wyse/companion-has-owner": "warn",
};

const basePlugins: LintPlugin[] = ["eslint", "unicorn", "oxc", "import", "promise", "typescript"];

function errors(prefix: string, names: string[]): DummyRuleMap {
  return Object.fromEntries(names.map((name) => [`${prefix}/${name}`, "error"]));
}

const wysePlugin: ExternalPluginEntry = {
  name: "wyse",
  specifier: fileURLToPath(new URL(`./index${extname(import.meta.url)}`, import.meta.url)),
};

function filesFor(value: FileScope, defaults: string[]): string[] {
  return value === true ? defaults : value || [];
}

function ownedRule(rule: string, owners: string[], excludeFiles: string[]): OxlintOverride[] {
  return [
    { files: sourceFiles, excludeFiles, rules: { [rule]: "error" } },
    { files: [...entrypointFiles, ...owners], rules: { [rule]: "off" } },
  ];
}

function electronRenderer(electron: true | { renderer?: string[] }): string[] {
  return electron === true || !electron.renderer ? electronRendererFiles : electron.renderer;
}

function reactScope(react: FileScope, nextjs: FileScope): string[] | false {
  if (react === true || nextjs === true) {
    return sourceFiles;
  }

  const files = [...(react || []), ...(nextjs || [])];

  return files.length > 0 ? [...new Set(files)] : false;
}

const baseErrors = errors("wyse", [
  "no-array-filter-map",
  "no-reduce-accumulator-copy",
  "no-chained-type-assertions",
  "no-conditional-empty-object-spread",
  "no-known-value-widening",
  "no-module-mocking",
  "no-object-parameters",
  "no-reflect-apply",
  "no-reflect-get",
  "no-shape-in-symbol-names",
  "no-unknown-returns",
  "no-unknown-type-aliases",
  "no-unsafe-dictionary-type",
  "no-widen-then-assert",
]);

const typeAwareRules: DummyRuleMap = {
  ...errors("typescript", [
    "await-thenable",
    "no-misused-promises",
    "no-unnecessary-condition",
    "no-unnecessary-type-assertion",
    "no-unsafe-argument",
    "no-unsafe-assignment",
    "no-unsafe-call",
    "no-unsafe-member-access",
    "no-unsafe-return",
    "no-unsafe-type-assertion",
    "only-throw-error",
    "prefer-readonly",
    "return-await",
    "switch-exhaustiveness-check",
  ]),
  "typescript/no-floating-promises": [
    "error",
    {
      allowForKnownSafeCalls: [
        { from: "package", package: "node:test", name: ["test", "it", "describe", "suite"] },
      ],
    },
  ],
};

const reactRules = errors("react", [
  "capitalized-calls",
  "error-boundaries",
  "exhaustive-effect-dependencies",
  "globals",
  "hooks",
  "immutability",
  "incompatible-library",
  "invariant",
  "memo-dependencies",
  "no-deriving-state-in-effects",
  "preserve-manual-memoization",
  "purity",
  "refs",
  "rule-suppression",
  "set-state-in-effect",
  "set-state-in-render",
  "static-components",
  "syntax",
  "todo",
  "unsupported-syntax",
  "use-memo",
  "void-use-memo",
  "forward-ref-uses-ref",
  "iframe-missing-sandbox",
  "jsx-key",
  "jsx-no-comment-textnodes",
  "jsx-no-duplicate-props",
  "jsx-no-script-url",
  "jsx-no-undef",
  "jsx-props-no-spread-multi",
  "no-children-prop",
  "no-danger-with-children",
  "no-did-mount-set-state",
  "no-did-update-set-state",
  "no-direct-mutation-state",
  "no-find-dom-node",
  "no-is-mounted",
  "no-namespace",
  "no-render-return-value",
  "no-string-refs",
  "no-this-in-sfc",
  "no-unsafe",
  "no-unstable-nested-components",
  "no-will-update-set-state",
  "style-prop-object",
  "void-dom-elements-no-children",
]);

const accessibilityRules = errors("jsx-a11y", [
  "alt-text",
  "anchor-has-content",
  "anchor-is-valid",
  "aria-activedescendant-has-tabindex",
  "aria-props",
  "aria-proptypes",
  "aria-role",
  "aria-unsupported-elements",
  "autocomplete-valid",
  "click-events-have-key-events",
  "control-has-associated-label",
  "heading-has-content",
  "html-has-lang",
  "iframe-has-title",
  "img-redundant-alt",
  "interactive-supports-focus",
  "label-has-associated-control",
  "lang",
  "media-has-caption",
  "mouse-events-have-key-events",
  "no-access-key",
  "no-aria-hidden-on-focusable",
  "no-autofocus",
  "no-distracting-elements",
  "no-interactive-element-to-noninteractive-role",
  "no-noninteractive-element-interactions",
  "no-noninteractive-element-to-interactive-role",
  "no-redundant-roles",
  "no-static-element-interactions",
  "role-has-required-aria-props",
  "role-supports-aria-props",
  "scope",
  "tabindex-no-positive",
]);

const nextRules = errors("nextjs", [
  "google-font-display",
  "google-font-preconnect",
  "inline-script-id",
  "next-script-for-ga",
  "no-assign-module-variable",
  "no-async-client-component",
  "no-before-interactive-script-outside-document",
  "no-css-tags",
  "no-document-import-in-page",
  "no-duplicate-head",
  "no-head-element",
  "no-head-import-in-document",
  "no-html-link-for-pages",
  "no-img-element",
  "no-page-custom-font",
  "no-script-component-in-head",
  "no-styled-jsx-in-document",
  "no-sync-scripts",
  "no-title-in-document-head",
  "no-typos",
  "no-unwanted-polyfillio",
]);

const reactEffectRules = errors("react-you-might-not-need-an-effect", [
  "no-adjust-state-on-prop-change",
  "no-chain-state-updates",
  "no-derived-state",
  "no-event-handler",
  "no-external-store-subscription",
  "no-initialize-state",
  "no-pass-data-to-parent",
  "no-pass-live-state-to-parent",
  "no-reset-all-state-on-prop-change",
]);

const browserPerformanceRules = errors("e18e", [
  "prefer-array-at",
  "prefer-array-fill",
  "prefer-array-from-map",
  "prefer-array-some",
  "prefer-date-now",
  "prefer-includes",
  "prefer-nullish-coalescing",
  "prefer-object-has-own",
  "prefer-regex-test",
  "prefer-spread-syntax",
  "prefer-static-regex",
  "prefer-string-fromcharcode",
  "prefer-timer-args",
]);

const testRuleNames = [
  "no-conditional-expect",
  "no-disabled-tests",
  "no-duplicate-hooks",
  "no-focused-tests",
  "no-identical-title",
  "no-standalone-expect",
  "valid-describe-callback",
  "valid-expect",
  "valid-expect-in-promise",
];

export function createLintConfig({
  typeAware = true,
  node = false,
  react = false,
  nextjs = false,
  vitest = false,
  jest = false,
  effect = false,
  tests = [],
  env,
  boundaries = [],
  serverActionGuards,
  clock,
  random,
  electron = false,
}: LintOptions = {}): SharedLintConfig {
  const nextRoots = filesFor(nextjs, ["."]).map((root) => {
    const normalized = root.replace(/^\.\//, "").replace(/\/+$/, "");

    return normalized === "." || normalized === "" ? "" : `${normalized}/`;
  });

  const nextFiles = nextRoots.flatMap((root) => sourceFiles.map((pattern) => `${root}${pattern}`));
  const reactFiles = reactScope(react, nextFiles);

  const allTestFiles = [
    ...new Set([
      ...testFiles,
      ...tests,
      ...filesFor(vitest, testFiles),
      ...filesFor(jest, testFiles),
    ]),
  ];

  const jsPlugins: ExternalPluginEntry[] = [wysePlugin];

  const typescriptRules: DummyRuleMap = {
    ...errors("typescript", [
      "ban-ts-comment",
      "consistent-type-imports",
      "no-explicit-any",
      "no-non-null-assertion",
      "no-empty-object-type",
      "no-unnecessary-type-constraint",
    ]),
    "wyse/type-guard-name": "error",
  };

  const overrides: OxlintOverride[] = [
    {
      files: entrypointFiles,
      plugins: [...basePlugins, "node"],
      env: { node: true },
      rules: {
        "import/no-default-export": "off",
        "eslint/no-console": "off",
        "wyse/no-forwarding-module": "off",
      },
    },
    {
      files: defaultExportFiles,
      rules: { "import/no-default-export": "off" },
    },
    { files: allTestFiles, rules: testRules },
    {
      files: allTestFiles,
      excludeFiles: endToEndFiles,
      rules: { "wyse/no-test-timeout-overrides": "warn" },
    },
  ];

  if (env !== undefined && env.length > 0) {
    overrides.push(...ownedRule("wyse/no-env-access", env, []));
  }

  if (clock !== undefined && clock.length > 0) {
    overrides.push(...ownedRule("wyse/no-ambient-clock", clock, allTestFiles));
  }

  if (random !== undefined && random.length > 0) {
    overrides.push(...ownedRule("wyse/no-ambient-random", random, allTestFiles));
  }

  const importBoundaries: ImportBoundary[] = electron
    ? [
        ...boundaries,
        {
          files: electronRenderer(electron),
          ignore: allTestFiles,
          deny: ["electron", "electron/**", "@electron/**", "node:*", "node:*/**"],
          message: "Renderer code reaches Electron and Node through the preload API.",
        },
      ]
    : boundaries;

  if (importBoundaries.length > 0) {
    overrides.push({
      files: sourceFiles,
      rules: { "wyse/import-boundaries": ["error", { boundaries: importBoundaries }] },
    });
  }

  if (electron) {
    overrides.push(
      { files: sourceFiles, rules: { "wyse/electron-no-remote-module": "error" } },
      {
        files: sourceFiles,
        excludeFiles: allTestFiles,
        rules: {
          "wyse/electron-secure-web-preferences": "error",
          "wyse/electron-no-raw-ipc-renderer-exposure": "error",
        },
      },
    );
  }

  if (serverActionGuards !== undefined && serverActionGuards.length > 0) {
    overrides.push({
      files: sourceFiles,
      excludeFiles: allTestFiles,
      rules: { "wyse/server-action-guard": ["error", { guards: serverActionGuards }] },
    });
  }

  if (typeAware) {
    overrides.unshift({ files: typeScriptFiles, rules: typeAwareRules });
  }

  if (node) {
    overrides.push({
      files: filesFor(node, sourceFiles),
      plugins: [...basePlugins, "node"],
      env: { node: true },
      rules: {
        "node/no-new-require": "error",
        "node/no-path-concat": "error",
        "node/no-exports-assign": "error",
      },
    });
  }

  if (reactFiles) {
    jsPlugins.push(
      { name: "e18e", specifier: require.resolve("@e18e/eslint-plugin") },
      {
        name: "react-you-might-not-need-an-effect",
        specifier: require.resolve("eslint-plugin-react-you-might-not-need-an-effect"),
      },
    );
    overrides.push(
      {
        files: reactFiles,
        plugins: [...basePlugins, "react", "jsx-a11y"],
        env: { browser: true },
        rules: {
          ...reactRules,
          ...accessibilityRules,
          "react/exhaustive-deps": "error",
          "react/no-array-index-key": "error",
          "react/react-in-jsx-scope": "off",
          "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["region", "tabpanel"] }],
          "jsx-a11y/prefer-tag-over-role": "off",
        },
      },
      {
        files: reactFiles,
        excludeFiles: allTestFiles,
        rules: { ...reactEffectRules, ...browserPerformanceRules },
      },
    );
  }

  if (nextFiles.length > 0) {
    overrides.push(
      {
        files: nextFiles,
        excludeFiles: allTestFiles,
        plugins: [...basePlugins, "react", "jsx-a11y", "nextjs"],
        rules: nextRules,
      },
      {
        files: nextRoots.flatMap((root) =>
          ["", "src/"].flatMap((source) => [
            `${root}${source}app/**/{page,layout,template,loading,error,global-error,not-found,global-not-found,forbidden,unauthorized,default}.{js,jsx,ts,tsx}`,
            `${root}${source}app/**/{sitemap,robots,manifest,icon,apple-icon,opengraph-image,twitter-image}.{js,jsx,ts,tsx}`,
            `${root}${source}pages/**/*.{js,jsx,ts,tsx}`,
            `${root}${source}{middleware,proxy}.{js,ts}`,
          ]),
        ),
        excludeFiles: allTestFiles,
        rules: { "import/no-default-export": "off" },
      },
    );
  }

  const testRunners: ["vitest" | "jest", FileScope][] = [
    ["vitest", vitest],
    ["jest", jest],
  ];

  for (const [name, value] of testRunners) {
    if (value) {
      overrides.push({
        files: filesFor(value, allTestFiles),
        plugins: [...basePlugins, name],
        env: { [name]: true },
        rules: {
          ...errors(name, testRuleNames),
          ...testRules,
          [`${name}/no-standalone-expect`]: [
            "error",
            { additionalTestBlockFunctions: ["it.effect", "it.live"] },
          ],
        },
      });
    }
  }

  if (effect) {
    overrides.push({
      files: filesFor(effect, typeScriptFiles),
      rules: errors("wyse", ["no-manual-effect-error-tag", "no-service-constructor-imports"]),
    });
  }

  return {
    categories: { correctness: "error", suspicious: "error" },
    options: { reportUnusedDisableDirectives: "error", typeAware },
    plugins: basePlugins,
    jsPlugins,
    env: { es2022: true },
    ignorePatterns: defaultIgnores,
    rules: {
      ...baseErrors,
      ...typescriptRules,
      "wyse/no-runtime-typeof": ["warn", { allowInTypeGuards: true }],
      "wyse/no-comments": "error",
      "wyse/statement-spacing": "error",
      "wyse/no-generic-file-suffix": "error",
      "wyse/no-swallowed-errors": "warn",
      "wyse/explicit-api-states": "warn",
      "wyse/no-pass-through-function": "warn",
      "wyse/no-forwarding-module": "warn",
      "import/no-cycle": "warn",
      "oxc/no-barrel-file": "warn",
      "eslint/curly": ["error", "all"],
      "eslint/eqeqeq": ["error", "always"],
      "eslint/no-console": "error",
      "eslint/no-empty": ["error", { allowEmptyCatch: false }],
      "eslint/no-implicit-coercion": "error",
      "eslint/no-param-reassign": "error",
      "eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "eslint/no-use-before-define": [
        "error",
        { functions: true, classes: true, variables: true, allowNamedExports: false },
      ],
      "eslint/no-underscore-dangle": "off",
      "eslint/prefer-const": "error",
      "import/first": "error",
      "import/no-default-export": "error",
      "import/no-duplicates": "error",
      "import/no-self-import": "error",
      "import/no-unassigned-import": [
        "error",
        { allow: ["**/*.css", "server-only", "client-only"] },
      ],
      "oxc/no-accumulating-spread": "error",
      "unicorn/no-nested-ternary": "off",
      "wyse/no-deep-ternary": "error",
      "unicorn/require-module-specifiers": "error",
      "unicorn/consistent-function-scoping": "off",
    },
    overrides,
  };
}
