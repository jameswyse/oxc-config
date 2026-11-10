import { createRequire } from "node:module";

import { errorRules, filesFor } from "../preset.ts";

import type { FileScope, Profile } from "../preset.ts";

const require = createRequire(import.meta.url);

const reactRules = errorRules("react", [
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
  "exhaustive-deps",
  "no-array-index-key",
  "checked-requires-onchange-or-readonly",
  "no-unknown-property",
]);

const accessibilityRules = errorRules("jsx-a11y", [
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
  "heading-has-content",
  "html-has-lang",
  "iframe-has-title",
  "img-redundant-alt",
  "interactive-supports-focus",
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

const effectRules = errorRules("react-you-might-not-need-an-effect", [
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

const browserPerformanceRules = errorRules("e18e", [
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

export const react: Profile<FileScope> = (scope, option) => {
  const files = filesFor(option, scope.source);

  return [
    {
      files,
      plugins: ["react", "jsx-a11y"],
      env: { browser: true },
      rules: {
        ...reactRules,
        ...accessibilityRules,
        "react/react-in-jsx-scope": "off",
        "react/jsx-no-useless-fragment": ["error", { allowExpressions: true }],
        "jsx-a11y/control-has-associated-label": [
          "error",
          {
            ignoreElements: ["audio", "canvas", "embed", "input", "td", "textarea", "tr", "video"],
          },
        ],
        "jsx-a11y/label-has-associated-control": ["error", { depth: 25 }],
        "jsx-a11y/no-noninteractive-tabindex": ["error", { roles: ["region", "tabpanel"] }],
        "jsx-a11y/prefer-tag-over-role": "off",
        "wyse/no-get-password-form": "error",
      },
    },
    {
      files,
      excludeFiles: scope.tests,
      jsPlugins: [
        { name: "e18e", specifier: require.resolve("@e18e/eslint-plugin") },
        {
          name: "react-you-might-not-need-an-effect",
          specifier: require.resolve("eslint-plugin-react-you-might-not-need-an-effect"),
        },
      ],
      rules: { ...effectRules, ...browserPerformanceRules },
    },
    {
      files,
      excludeFiles: [...scope.endToEnd, "**/tests/**"],
      rules: { "react/rules-of-hooks": "error" },
    },
  ];
};
