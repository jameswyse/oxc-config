import type { Profile } from "../preset.ts";

const rendererFiles = ["src/renderer/**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"];

export const electron: Profile<true | { renderer?: string[] }> = (scope, option) => [
  {
    boundaries: [
      {
        files: option === true || !option.renderer ? rendererFiles : option.renderer,
        ignore: scope.tests,
        deny: ["electron", "electron/**", "@electron/**", "node:*", "node:*/**"],
        message: "Renderer code reaches Electron and Node through the preload API.",
      },
    ],
  },
  { files: scope.source, rules: { "wyse/electron-no-remote-module": "error" } },
  {
    files: scope.source,
    excludeFiles: scope.tests,
    rules: {
      "wyse/electron-secure-web-preferences": "error",
      "wyse/electron-no-raw-ipc-renderer-exposure": "error",
    },
  },
];
