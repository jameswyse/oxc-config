import { ruleTester } from "../shared/rule-tester.ts";
import { electronSecureWebPreferences } from "./electron-secure-web-preferences.ts";

const hardened = "contextIsolation: true, sandbox: true, nodeIntegration: false";

ruleTester.run("electron-secure-web-preferences", electronSecureWebPreferences, {
  valid: [
    `new BrowserWindow({ width: 800, webPreferences: { preload, ${hardened} } });`,
    `new BrowserWindow({ webPreferences: { "contextIsolation": true, ["sandbox"]: true, nodeIntegration: false } });`,
    `new BrowserWindow({ webPreferences: { ${hardened}, webSecurity: true, allowRunningInsecureContent: false, experimentalFeatures: false, enableBlinkFeatures: "", webviewTag: false } });`,
    `new BrowserWindow({ webPreferences: { ...base, ${hardened} } });`,
    `const webPreferences = { ${hardened} }; new BrowserWindow({ webPreferences });`,
    `new BrowserWindow({ webPreferences: { ${hardened} } satisfies WebPreferences });`,
    "new BrowserWindow({ webPreferences: createWebPreferences() });",
    "new BrowserWindow({ width: 800 });",
    "const settings = { preferences: { nodeIntegration: true } };",
  ],
  invalid: [
    {
      code: "new BrowserWindow({ webPreferences: { contextIsolation: true, nodeIntegration: false } });",
      errors: [{ messageId: "insecure" }],
    },
    {
      code: "new BrowserWindow({ webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: true } });",
      errors: [{ messageId: "insecure" }],
    },
    {
      code: "new BrowserWindow({ webPreferences: { contextIsolation: isolated, sandbox: true, nodeIntegration: false } });",
      errors: [{ messageId: "insecure" }],
    },
    {
      code: `new BrowserWindow({ webPreferences: { ${hardened}, webSecurity: false } });`,
      errors: [{ messageId: "dangerous", data: { name: "webSecurity" } }],
    },
    {
      code: `new BrowserWindow({ webPreferences: { ${hardened}, allowRunningInsecureContent: true, enableRemoteModule: true, nodeIntegrationInSubFrames: true, nodeIntegrationInWorker: true, webviewTag: true } });`,
      errors: [
        { messageId: "dangerous", data: { name: "allowRunningInsecureContent" } },
        { messageId: "dangerous", data: { name: "enableRemoteModule" } },
        { messageId: "dangerous", data: { name: "nodeIntegrationInSubFrames" } },
        { messageId: "dangerous", data: { name: "nodeIntegrationInWorker" } },
        { messageId: "dangerous", data: { name: "webviewTag" } },
      ],
    },
    {
      code: `new BrowserWindow({ webPreferences: { ${hardened}, experimentalFeatures: true, enableBlinkFeatures: "CSSVariables" } });`,
      errors: [
        { messageId: "dangerous", data: { name: "experimentalFeatures" } },
        { messageId: "dangerous", data: { name: "enableBlinkFeatures" } },
      ],
    },
    {
      code: `new BrowserWindow({ webPreferences: { ${hardened}, webSecurity: !isDevelopment } });`,
      errors: [{ messageId: "dangerous", data: { name: "webSecurity" } }],
    },
    {
      code: `new BrowserWindow({ webPreferences: { ${hardened}, ...overrides } });`,
      errors: [{ messageId: "insecure" }],
    },
    {
      code: `new BrowserWindow({ webPreferences: { ${hardened}, [key]: value } });`,
      errors: [{ messageId: "insecure" }],
    },
    {
      code: `new BrowserWindow({ webPreferences: { ${hardened}, sandbox: false } });`,
      errors: [{ messageId: "insecure" }],
    },
    {
      code: "const webPreferences = { contextIsolation: true, sandbox: false, nodeIntegration: false }; new BrowserWindow({ webPreferences });",
      errors: [{ messageId: "insecure" }],
    },
    {
      code: "new BrowserWindow({ webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: true } satisfies WebPreferences });",
      errors: [{ messageId: "insecure" }],
    },
    {
      code: `window.webContents.setWindowOpenHandler(() => ({ action: "allow", overrideBrowserWindowOptions: { webPreferences: { ${hardened}, webviewTag: true } } }));`,
      errors: [{ messageId: "dangerous", data: { name: "webviewTag" } }],
    },
  ],
});
