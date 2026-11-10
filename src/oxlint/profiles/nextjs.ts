import { appFiles, appPrefixes, errorRules } from "../preset.ts";
import { react } from "./react.ts";

import type { AppRoots, Profile } from "../preset.ts";

const nextRules = errorRules("nextjs", [
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

export const nextjs: Profile<AppRoots> = (scope, roots) => [
  ...react(scope, appFiles(scope, roots)),
  {
    files: appFiles(scope, roots),
    excludeFiles: scope.tests,
    plugins: ["react", "jsx-a11y", "nextjs"],
    rules: nextRules,
  },
  {
    files: appPrefixes(roots).flatMap((prefix) =>
      ["", "src/"].flatMap((source) => [
        `${prefix}${source}app/**/{page,layout,template,loading,error,global-error,not-found,global-not-found,forbidden,unauthorized,default}.{js,jsx,ts,tsx}`,
        `${prefix}${source}app/**/{sitemap,robots,manifest,icon,apple-icon,opengraph-image,twitter-image}.{js,jsx,ts,tsx}`,
        `${prefix}${source}pages/**/*.{js,jsx,ts,tsx}`,
        `${prefix}${source}{middleware,proxy}.{js,ts}`,
      ]),
    ),
    excludeFiles: scope.tests,
    rules: { "import/no-default-export": "off" },
  },
];
